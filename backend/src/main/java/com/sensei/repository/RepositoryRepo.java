package com.sensei.repository;

import com.sensei.entity.RepositoryEntity;
import com.sensei.model.RepoStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RepositoryRepo extends JpaRepository<RepositoryEntity, Long> {
    Optional<RepositoryEntity> findByGithubUrlAndUser(String githubUrl, com.sensei.entity.UserEntity user);
    List<RepositoryEntity> findByUserOrderByIdDesc(com.sensei.entity.UserEntity user);
    Optional<RepositoryEntity> findByIdAndUser(Long id, com.sensei.entity.UserEntity user);
    List<RepositoryEntity> findAllByOrderByIdDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RepositoryEntity r WHERE r.githubUrl = :githubUrl AND r.user = :user")
    Optional<RepositoryEntity> findByGithubUrlAndUserForUpdate(
            @Param("githubUrl") String githubUrl,
            @Param("user") com.sensei.entity.UserEntity user
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RepositoryEntity r WHERE r.id = :id AND r.user = :user")
    Optional<RepositoryEntity> findByIdAndUserForUpdate(
            @Param("id") Long id,
            @Param("user") com.sensei.entity.UserEntity user
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT r FROM RepositoryEntity r WHERE r.id = :id")
    Optional<RepositoryEntity> findByIdForUpdate(@Param("id") Long id);
}
