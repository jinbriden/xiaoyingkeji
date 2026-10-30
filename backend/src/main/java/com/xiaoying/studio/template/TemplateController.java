package com.xiaoying.studio.template;

import java.util.List;

import com.xiaoying.studio.common.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class TemplateController {

    public record TemplateResponse(String id, String title, String category, String coverUrl, String description,
                                   int requiredImageCount, List<String> acceptedMimeTypes, long maxFileSizeBytes) {
        static TemplateResponse of(Template t) {
            return new TemplateResponse(t.getId(), t.getTitle(), t.getCategory(), t.getCoverUrl(), t.getDescription(),
                    t.getRequiredImageCount(), t.acceptedMimeTypeList(), t.getMaxFileSizeBytes());
        }
    }

    private final TemplateMapper templateMapper;

    public TemplateController(TemplateMapper templateMapper) {
        this.templateMapper = templateMapper;
    }

    @GetMapping("/template-categories")
    public List<String> categories() {
        return templateMapper.findCategories();
    }

    @GetMapping("/templates")
    public List<TemplateResponse> templates(@RequestParam(required = false) String category) {
        return templateMapper.findAll(category).stream().map(TemplateResponse::of).toList();
    }

    @GetMapping("/templates/{id}")
    public TemplateResponse template(@PathVariable String id) {
        Template template = templateMapper.findById(id);
        if (template == null) {
            throw ApiException.notFound("TEMPLATE_NOT_FOUND", "模板不存在");
        }
        return TemplateResponse.of(template);
    }
}
