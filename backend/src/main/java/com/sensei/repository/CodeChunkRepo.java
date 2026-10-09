package com.sensei.repository;

import com.sensei.entity.CodeChunkEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CodeChunkRepo extends JpaRepository<CodeChunkEntity, Long> {
    List<CodeChunkEntity> findByRepoId(Long repoId);
    List<CodeChunkEntity> findByRepoIdAndChunkType(Long repoId, String chunkType);

    @Query("SELECT c FROM CodeChunkEntity c WHERE c.repoId = :repoId AND " +
           "(LOWER(c.content) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(c.entityName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(c.filePath) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<CodeChunkEntity> searchByKeyword(@Param("repoId") Long repoId, @Param("keyword") String keyword);

    void deleteByRepoId(Long repoId);
}
