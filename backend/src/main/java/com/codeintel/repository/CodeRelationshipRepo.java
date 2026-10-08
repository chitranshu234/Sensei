package com.codeintel.repository;

import com.codeintel.entity.CodeRelationshipEntity;
import com.codeintel.model.RelationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeRelationshipRepo extends JpaRepository<CodeRelationshipEntity, Long> {
    List<CodeRelationshipEntity> findByRepoId(Long repoId);
    List<CodeRelationshipEntity> findByRepoIdAndRelationType(Long repoId, RelationType relationType);
    List<CodeRelationshipEntity> findByRepoIdAndSourceEntityId(Long repoId, Long sourceEntityId);
    List<CodeRelationshipEntity> findByRepoIdAndTargetEntityId(Long repoId, Long targetEntityId);
    void deleteByRepoId(Long repoId);
}
