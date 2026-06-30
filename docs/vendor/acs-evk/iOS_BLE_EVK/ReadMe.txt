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


-------------------------------------------------------------------------------
Copyright (c) 2017-2025, Advanced Card Systems Ltd. All rights reserved.

OpenJDK
Copyright (c) 1996-2014, Oracle and/or its affiliates. All rights reserved.

This code is free software; you can redistribute it and/or modify it
under the terms of the GNU General Public License version 2 only, as
published by the Free Software Foundation.  Oracle designates this
particular file as subject to the "Classpath" exception as provided
by Oracle in the LICENSE file that accompanied this code.

This code is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
version 2 for more details (a copy is included in the LICENSE file that
accompanied this code).

You should have received a copy of the GNU General Public License version
2 along with this work; if not, write to the Free Software Foundation,
Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.

IOS is a trademark or registered trademark of Cisco in the U.S. and other
countries and is used under license.

Xcode is a trademark of Apple Inc.