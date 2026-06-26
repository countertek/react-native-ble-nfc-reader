ACS Smart Card I/O Android Library
Advanced Card Systems Ltd.



Introduction
------------

The library "acssmcio" provides classes and interfaces for communicating with
ACS Bluetooth readers. It is based on the service provider interface
(TerminalFactorySpi) from Java Smart Card I/O API defined by JSR 268 [1].

The Java Smart Card I/O API defines a Java API for communication with Smart
Cards using ISO/IEC 7816-4 APDUs. It thereby allows Java applications to
interact with applications running on the Smart Card, to store and retrieve data
on the card, etc.

The library "smartcardio" imports Java packages from OpenJDK:
- javax.smartcardio
- sun.net.www
- sun.nio.cs
- sun.security.action
- sun.security.jca
- sun.security.util

To install libraries to your development environment, see the section
"Installation".

[1] https://jcp.org/en/jsr/detail?id=268



Release Notes
-------------

Version:      0.6.2
Release Date: 3/12/2025

System Requirements

Library
- Android 5.0 (Lollipop) or later

Demo
- Android 6.0 (Marshmallow) or later

Development Environment

- Android Studio Otter 2025.2.1 Patch 1 or later.
  See Android Developers [1] for more information.

[1] https://developer.android.com/

Supported Readers

- ACR3901U-S1/ACR3901T-W1
- ACR1255U-J1
- ACR1255U-J1 V2
- AMR220-C
- ACR1555U



Installation
------------

1. To try the demo project, select Open from File menu on Android Studio. Choose
   "BLETest".

2. To use the class library to your project, copy "acssmcio-x.y.z.aar" and
   "smartcardio-x.y.z.aar" to your "app\libs" folder.

3. Go to File -> Project Structure -> Dependencies.

4. In the "Declared Dependencies" tab, click and select "Jar Dependency" in the
   dropdown.

5. In the "Add Jar/Aar Dependency" dialog, enter the path to
   "libs/acssmcio-x.y.z.aar" and select "implementation" configuration.

6. Follow the above steps to add "libs/smartcardio-x.y.z.aar".

7. You will see the following lines from your app's "build.gradle" file.

   implementation files('libs/acssmcio-x.y.z.aar')
   implementation files('libs/smartcardio-x.y.z.aar')


File Contents
-------------

API Documentation:  doc
Sample Application: BLETest
Android Package:    BLETest-0.6.2.apk
Class Library:      BLETest\app\libs\acssmcio-0.6.2.aar
                    BLETest\app\libs\smartcardio-0.1.7.aar
Scripts:            scripts
