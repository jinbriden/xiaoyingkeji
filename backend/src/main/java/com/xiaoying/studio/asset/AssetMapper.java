package com.xiaoying.studio.asset;

import java.util.List;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AssetMapper {

    @Insert("""
            INSERT INTO asset (id, user_id, storage_path, mime_type, size_bytes, created_at)
            VALUES (#{id}, #{userId}, #{storagePath}, #{mimeType}, #{sizeBytes}, #{createdAt})
            """)
    void insert(Asset asset);

    @Select("""
            <script>
            SELECT id, user_id, storage_path, mime_type, size_bytes, created_at
            FROM asset
            WHERE user_id = #{userId} AND id IN
            <foreach collection="ids" item="id" open="(" separator="," close=")">#{id}</foreach>
            </script>
            """)
    List<Asset> findOwned(@Param("userId") String userId, @Param("ids") List<String> ids);

    @Select("""
            SELECT a.id, a.user_id, a.storage_path, a.mime_type, a.size_bytes, a.created_at
            FROM task_asset ta JOIN asset a ON a.id = ta.asset_id
            WHERE ta.task_id = #{taskId}
            ORDER BY ta.sort_index
            """)
    List<Asset> findByTask(String taskId);
}
