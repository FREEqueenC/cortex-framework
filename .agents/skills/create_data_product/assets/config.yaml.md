# Main Configuration Template

```yaml
data:
  namespaces:
    - name: cortex
      path: cortex
    - name: <namespace>
      path: <namespace>
  modules:
    products:
      # ...
      - moduleId: <unique_module_id>
        modulePath: <namespace>.<source>.products.<type>
        dependencyBindings:
          <dependency_module>: <foundation_module_id> # e.g., sapModule: erp
        dataTargetId: <target_id> # e.g., product_target (must correspond to an id in data.targets)
```
