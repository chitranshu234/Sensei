package com.codeintel.repository;

import com.codeintel.entity.CodeFileEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeFileRepo extends JpaRepository<CodeFileEntity, Long> {
    List<CodeFileEntity> findByRepoId(Long repoId);
    void deleteByRepoId(Long repoId);
}
