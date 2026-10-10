package com.sensei.repository;

import com.sensei.entity.CodeEntity;
import com.sensei.model.EntityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeEntityRepo extends JpaRepository<CodeEntity, Long> {
    List<CodeEntity> findByRepoIdOrderByIdAsc(Long repoId);
    List<CodeEntity> findByRepoIdAndEntityType(Long repoId, EntityType entityType);
    List<CodeEntity> findByRepoIdAndEntityTypeInOrderByIdAsc(Long repoId, List<EntityType> types);
    List<CodeEntity> findByRepoIdAndNameContainingIgnoreCase(Long repoId, String name);
    void deleteByRepoId(Long repoId);
}
