ACS Smart Card I/O iOS Framework
Advanced Card Systems Ltd.



Introduction
------------

The framework "ACSSmartCardIO" provides classes and interfaces for communicating
with ACS Bluetooth readers. It is based on the service provider interface
(TerminalFactorySpi) from Java Smart Card I/O API defined by JSR 268 [1].

The Java Smart Card I/O API defines a Java API for communication with Smart
Cards using ISO/IEC 7816-4 APDUs. It thereby allows Java applications to
interact with applications running on the Smart Card, to store and retrieve data
on the card, etc.

The framework "SmartCardIO" contains the following source code from OpenJDK
which is ported to Swift:
- javax.smartcardio
- java.security.Provider

To install frameworks to your development environment, see the section
"Installation".

[1] https://jcp.org/en/jsr/detail?id=268



Release Notes
-------------

Version:      0.6.2
Release Date: 4/12/2025

System Requirements

- iOS 15.0 or later

Development Environment

- Xcode 26.1.1 or later

Supported Readers

- ACR3901U-S1/ACR3901T-W1
- ACR1255U-J1
- ACR1255U-J1 V2
- AMR220-C
- ACR1555U



Installation
------------

1. To use the framework to your project, copy the folder
   "BLETest\SmartCardIO.xcframework" and "BLETest\ACSSmartCardIO.xcframework" to
   your project folder.

2. Select General tab in the Targets and click "+" in Embedded Binaries.

3. When a dialog appears, click on "Add Other..." button to add frameworks to
   your project.


File Contents
-------------

API Documentation:  doc
Sample Application: BLETest
Framework:          BLETest\SmartCardIO.xcframework
                    BLETest\ACSSmartCardIO.xcframework
Scripts:            scripts
