package com.xiaoying.studio.template;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface TemplateMapper {

    @Select("""
            <script>
            SELECT id, title, category, cover_url, description, required_image_count,
                   accepted_mime_types, max_file_size_bytes
            FROM template
            <if test="category != null and category != ''">WHERE category = #{category}</if>
            ORDER BY sort_order, id
            </script>
            """)
    List<Template> findAll(String category);

    @Select("""
            SELECT id, title, category, cover_url, description, required_image_count,
                   accepted_mime_types, max_file_size_bytes
            FROM template WHERE id = #{id}
            """)
    Template findById(String id);

    @Select("SELECT category FROM template GROUP BY category ORDER BY MIN(sort_order)")
    List<String> findCategories();
}
