package com.codeintel.service;

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
import java.util.Map;

@Service
public class GitCloneService {

    private static final Logger log = LoggerFactory.getLogger(GitCloneService.class);

    @Value("${app.storage.repo-dir:./storage/repos}")
    private String repoStorageDir;

    /**
     * Clones a public GitHub repository and returns the local directory path.
     * Auto-detects the default branch if none is specified.
     */
    public String cloneRepository(String githubUrl, String branch) throws GitAPIException, IOException {
        String repoName = extractRepoName(githubUrl);
        Path targetDir = Path.of(repoStorageDir, repoName + "-" + System.currentTimeMillis());
        Files.createDirectories(targetDir);

        String resolvedBranch = (branch != null && !branch.isBlank()) ? branch : detectDefaultBranch(githubUrl);
        log.info("Cloning {} (branch: {}) into {}", githubUrl, resolvedBranch, targetDir);

        Git.cloneRepository()
                .setURI(githubUrl + ".git")
                .setDirectory(targetDir.toFile())
                .setBranch(resolvedBranch)
                .setDepth(1) // shallow clone for speed
                .call()
                .close();

        log.info("Clone complete: {}", targetDir);
        return targetDir.toAbsolutePath().toString();
    }

    /**
     * Detects the default branch of a remote repository by reading HEAD via ls-remote.
     * Falls back to "main" if detection fails.
     */
    public String detectDefaultBranch(String githubUrl) {
        try {
            Collection<Ref> refs = Git.lsRemoteRepository()
                    .setRemote(githubUrl + ".git")
                    .setHeads(true)
                    .setTags(false)
                    .call();

            // Find HEAD and resolve its target
            for (Ref ref : refs) {
                if ("HEAD".equals(ref.getName())) {
                    Ref target = ref.getTarget();
                    if (target != null) {
                        String targetName = target.getName();
                        // refs/heads/master → master
                        String branchName = targetName.replace("refs/heads/", "");
                        log.info("Detected default branch for {}: {}", githubUrl, branchName);
                        return branchName;
                    }
                }
            }

            // Fallback: look for common branch names in the refs
            boolean hasMaster = refs.stream()
                    .anyMatch(r -> "refs/heads/master".equals(r.getName()));
            if (hasMaster) {
                log.info("HEAD detection failed, but found 'master' branch for {}", githubUrl);
                return "master";
            }

        } catch (GitAPIException e) {
            log.warn("Failed to detect default branch for {}: {}", githubUrl, e.getMessage());
        }
        log.info("Falling back to 'main' for {}", githubUrl);
        return "main";
    }

    /**
     * Deletes a previously cloned repository directory.
     */
    public void deleteClone(String clonePath) throws IOException {
        Path path = Path.of(clonePath);
        if (Files.exists(path)) {
            Files.walk(path)
                    .sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(File::delete);
            log.info("Deleted clone at {}", clonePath);
        }
    }

    private String extractRepoName(String githubUrl) {
        // https://github.com/owner/repo  →  owner-repo
        String cleaned = githubUrl.replaceAll("/$", "");
        String[] parts = cleaned.split("/");
        if (parts.length >= 2) {
            return parts[parts.length - 2] + "-" + parts[parts.length - 1];
        }
        return "unknown-repo";
    }
}
