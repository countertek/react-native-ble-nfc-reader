# Bundle ACS Native SDK Binaries When Redistribution Is Confirmed

The package should include the ACS Android AARs and iOS XCFrameworks so consumers do not manually copy vendor files. The bundled SmartCardIO/OpenJDK-derived code is documented as GPLv2 with the Classpath exception, but ACS-owned SDK components still need redistribution rights verified before public npm publishing; if redistribution is not permitted, the package must fail loudly and document the required local SDK placement.
