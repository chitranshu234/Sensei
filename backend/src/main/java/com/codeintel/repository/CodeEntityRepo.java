package com.codeintel.repository;

import com.codeintel.entity.CodeEntity;
import com.codeintel.model.EntityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeEntityRepo extends JpaRepository<CodeEntity, Long> {
    List<CodeEntity> findByRepoId(Long repoId);
    List<CodeEntity> findByRepoIdAndEntityType(Long repoId, EntityType entityType);
    List<CodeEntity> findByRepoIdAndEntityTypeIn(Long repoId, List<EntityType> types);
    List<CodeEntity> findByRepoIdAndNameContainingIgnoreCase(Long repoId, String name);
    void deleteByRepoId(Long repoId);
}
