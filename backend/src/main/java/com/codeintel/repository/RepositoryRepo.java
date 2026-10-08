package com.codeintel.repository;

import com.codeintel.entity.RepositoryEntity;
import com.codeintel.model.RepoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RepositoryRepo extends JpaRepository<RepositoryEntity, Long> {
    Optional<RepositoryEntity> findByGithubUrl(String githubUrl);
    List<RepositoryEntity> findByStatus(RepoStatus status);
    boolean existsByGithubUrl(String githubUrl);
}
