package com.sensei.repository;

import com.sensei.entity.RepositoryEntity;
import com.sensei.model.RepoStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RepositoryRepo extends JpaRepository<RepositoryEntity, Long> {
    Optional<RepositoryEntity> findByGithubUrlAndUser(String githubUrl, com.sensei.entity.UserEntity user);
    List<RepositoryEntity> findByUserOrderByIdDesc(com.sensei.entity.UserEntity user);
    Optional<RepositoryEntity> findByIdAndUser(Long id, com.sensei.entity.UserEntity user);
    List<RepositoryEntity> findAllByOrderByIdDesc();
}
