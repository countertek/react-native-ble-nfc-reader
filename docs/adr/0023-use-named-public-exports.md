# Use Named Public Exports

Consumers import named public functions and namespaces such as `scanReaders`, `connectReader`, and `mifare`. The native module default export remains internal so consumers do not depend on bridge implementation details.

