package com.sensei.service;

import com.sensei.exception.BadRequestException;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Ref;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
import java.util.Comparator;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Shallow-clones public GitHub repositories onto local disk using JGit.
 */
@Service
public class GitCloneService {

    private static final Logger log = LoggerFactory.getLogger(GitCloneService.class);

    /** Only GitHub HTTPS URLs are accepted — keeps JGit from being pointed at local paths or file:// URLs. */
    private static final Pattern GITHUB_URL =
            Pattern.compile("^https://github\\.com/[\\w.-]+/[\\w.-]+$");

    /** Anything outside this set is stripped from a branch name before it is used. */
    private static final Pattern UNSAFE_BRANCH_CHARS = Pattern.compile("[^\\w./-]");

    @Value("${app.storage.repo-dir:./storage/repos}")
    private String repoStorageDir;

    /**
     * Clone a repository and return the absolute path of the working copy.
     *
     * <p>The clone lands in a directory named with a random suffix rather than a timestamp, so a
     * retry of the same repository can never collide with — or partially overwrite — an earlier
     * attempt that is still on disk.
     */
    public String cloneRepository(String githubUrl, String branch) throws GitAPIException, IOException {
        String normalizedUrl = validateAndNormalizeUrl(githubUrl);
        String repoName = extractRepoName(normalizedUrl);
        String resolvedBranch = resolveBranch(normalizedUrl, branch);

        Path root = Path.of(repoStorageDir).toAbsolutePath().normalize();
        Files.createDirectories(root);

        Path targetDir = root.resolve(repoName + "-" + UUID.randomUUID().toString().substring(0, 8));
        log.info("Cloning {} (branch: {}) into {}", normalizedUrl, resolvedBranch, targetDir);

        try {
            try (Git git = Git.cloneRepository()
                    .setURI(normalizedUrl + ".git")
                    .setDirectory(targetDir.toFile())
                    .setBranch(resolvedBranch)
                    .setDepth(1)              // shallow: we only need a snapshot to analyse
                    .setCloneAllBranches(false)
                    .call()) {
                log.info("Clone complete: {}", targetDir);
            }
        } catch (Exception e) {
            boolean isInvalidPath = e.getClass().getSimpleName().contains("InvalidPathException") ||
                                    (e.getCause() != null && e.getCause().getClass().getSimpleName().contains("InvalidPathException")) ||
                                    (e.getCause() != null && e.getCause().getClass().getSimpleName().contains("CorruptObjectException")) ||
                                    (e.getMessage() != null && e.getMessage().contains("Invalid path")) ||
                                    e.getClass().getSimpleName().contains("JGitInternalException");


            if (isInvalidPath) {
                log.warn("Invalid paths detected during checkout (e.g. Windows unsupported characters). Falling back to manual checkout: {}", e.getMessage());
                safeDelete(targetDir);
                
                Path fallbackDir = root.resolve(repoName + "-fallback-" + UUID.randomUUID().toString().substring(0, 8));
                
                try (Git git = Git.cloneRepository()
                        .setURI(normalizedUrl + ".git")
                        .setDirectory(fallbackDir.toFile())
                        .setBranch(resolvedBranch)
                        .setDepth(1)
                        .setCloneAllBranches(false)
                        .setNoCheckout(true)
                        .call()) {
                        
                    org.eclipse.jgit.lib.Repository repo = git.getRepository();
                    org.eclipse.jgit.lib.Ref headRef = repo.exactRef("HEAD");
                    if (headRef != null && headRef.getObjectId() != null) {
                        try (org.eclipse.jgit.revwalk.RevWalk revWalk = new org.eclipse.jgit.revwalk.RevWalk(repo);
                             org.eclipse.jgit.treewalk.TreeWalk treeWalk = new org.eclipse.jgit.treewalk.TreeWalk(repo)) {
                            
                            org.eclipse.jgit.revwalk.RevCommit commit = revWalk.parseCommit(headRef.getObjectId());
                            treeWalk.addTree(commit.getTree());
                            treeWalk.setRecursive(true);
                            
                            while (treeWalk.next()) {
                                String path = treeWalk.getPathString();
                                // Skip files with invalid Windows characters
                                if (path.matches(".*[:*?\"<>|].*")) {
                                    continue;
                                }
                                
                                // Skip submodules (GitLinks) as they point to commits, not blobs
                                if (treeWalk.getFileMode(0).equals(org.eclipse.jgit.lib.FileMode.GITLINK)) {
                                    continue;
                                }

                                File file = new File(fallbackDir.toFile(), path);
                                File parent = file.getParentFile();
                                if (parent != null && !parent.exists()) {
                                    parent.mkdirs();
                                }
                                
                                org.eclipse.jgit.lib.ObjectId objectId = treeWalk.getObjectId(0);
                                org.eclipse.jgit.lib.ObjectLoader loader = repo.open(objectId);
                                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file)) {
                                    loader.copyTo(fos);
                                }
                            }
                        }
                    }
                    log.info("Manual fallback clone complete: {}", fallbackDir);
                    return fallbackDir.toString();
                } catch (Exception ex) {
                    safeDelete(fallbackDir);
                    if (ex instanceof GitAPIException) throw (GitAPIException) ex;
                    throw new RuntimeException("Fallback clone failed", ex);
                }
            } else {
                safeDelete(targetDir);
                if (e instanceof GitAPIException) throw (GitAPIException) e;
                if (e instanceof IOException) throw (IOException) e;
                throw new RuntimeException(e);
            }
        }

        return targetDir.toString();
    }

    /**
     * Discover a remote's default branch by inspecting its HEAD ref.
     *
     * <p>Falls back to {@code main}, then {@code master} via {@code ls-remote} only. The old
     * implementation returned {@code main} whenever HEAD could not be resolved, which failed
     * outright on the many repositories that still default to {@code master}.
     */
    public String detectDefaultBranch(String githubUrl) {
        String normalizedUrl;
        try {
            normalizedUrl = validateAndNormalizeUrl(githubUrl);
        } catch (BadRequestException e) {
            return "main";
        }

        try {
            Collection<Ref> refs = Git.lsRemoteRepository()
                    .setRemote(normalizedUrl + ".git")
                    .setHeads(true)
                    .setTags(false)
                    .call();

            for (Ref ref : refs) {
                if ("HEAD".equals(ref.getName())) {
                    Ref target = ref.getTarget();
                    if (target != null) {
                        String branchName = target.getName().replace("refs/heads/", "");
                        log.info("Detected default branch for {}: {}", normalizedUrl, branchName);
                        return branchName;
                    }
                }
            }

            // HEAD was not advertised; probe the two conventional names.
            for (Ref ref : refs) {
                if ("refs/heads/main".equals(ref.getName())) {
                    return "main";
                }
            }
            for (Ref ref : refs) {
                if ("refs/heads/master".equals(ref.getName())) {
                    return "master";
                }
            }
        } catch (GitAPIException e) {
            log.warn("Failed to detect default branch for {}: {}", normalizedUrl, e.getMessage());
        }

        log.info("Falling back to 'main' for {}", normalizedUrl);
        return "main";
    }

    /** Recursively delete a cloned working copy. */
    public void deleteClone(String clonePath) throws IOException {
        if (clonePath == null || clonePath.isBlank()) {
            return;
        }

        Path path = Path.of(clonePath).toAbsolutePath().normalize();
        Path root = Path.of(repoStorageDir).toAbsolutePath().normalize();

        // Refuse to delete anything outside the managed storage root. A corrupted or
        // tampered clonePath column must never turn a delete into an arbitrary rm -rf.
        if (!path.startsWith(root) || path.equals(root)) {
            log.warn("Refusing to delete path outside storage root: {}", path);
            return;
        }

        safeDelete(path);
        log.info("Deleted clone at {}", path);
    }

    private String resolveBranch(String normalizedUrl, String branch) {
        if (branch != null && !branch.isBlank()) {
            String cleaned = UNSAFE_BRANCH_CHARS.matcher(branch.trim()).replaceAll("");
            if (!cleaned.isBlank()) {
                return cleaned;
            }
        }
        return detectDefaultBranch(normalizedUrl);
    }

    /** Enforce GitHub HTTPS and strip a trailing {@code .git}. */
    private String validateAndNormalizeUrl(String githubUrl) {
        if (githubUrl == null || githubUrl.isBlank()) {
            throw new BadRequestException("GitHub URL is required");
        }
        String candidate = githubUrl.trim().replaceAll("/+$", "");
        if (candidate.endsWith(".git")) {
            candidate = candidate.substring(0, candidate.length() - 4);
        }
        if (!GITHUB_URL.matcher(candidate).matches()) {
            throw new BadRequestException("Only public GitHub repository URLs are supported.");
        }
        return candidate;
    }

    private void safeDelete(Path path) {
        if (!Files.exists(path)) {
            return;
        }
        try (var walk = Files.walk(path)) {
            walk.sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(File::delete);
        } catch (IOException e) {
            log.warn("Failed to fully delete {}: {}", path, e.getMessage());
        }
    }

    /** {@code https://github.com/owner/repo} → {@code owner-repo}. */
    private String extractRepoName(String githubUrl) {
        String[] parts = githubUrl.split("/");
        if (parts.length >= 2) {
            String owner = sanitize(parts[parts.length - 2]);
            String repo = sanitize(parts[parts.length - 1]);
            return owner + "-" + repo;
        }
        return "unknown-repo";
    }

    private String sanitize(String value) {
        String cleaned = value.replaceAll("[^\\w.-]", "_");
        return cleaned.isBlank() ? "repo" : cleaned;
    }
}
