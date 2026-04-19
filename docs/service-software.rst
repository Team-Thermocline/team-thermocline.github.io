****************
Software Service
****************

The Controller
==============

The Chamber Controller is a Raspberry Pi Pico (RP2040) installed into the Controller Mainboard at the rear in the 
machinery space. The controller code is written in C and compiled using the pico-sdk. You can download the code at our `github <https://github.com/Team-Thermocline/Controller/tree/main/Firmware>`_, or scan this QR code.

.. image:: images/Software/firmwareQR.png

Flashing Prebuilt Firmware
==========================

At the time of writing, the most recent firmware revision the team touched will be released at `https://github.com/Team-Thermocline/Controller/releases <https://github.com/Team-Thermocline/Controller/releases>`_. Download the prebuilt
.uf2 file and flash it to the controller using the instructions in :ref:`flashing-firmware`.

Building Custom Firmware
========================

To promote making it easier for future maintainers to make changes to the firmware, we used the built-in pico-sdk
auto-generate makefiles. The only thing you should need to build the code is `make` and basic buildutils for your system.

.. code-block:: bash

   # Clone the repository
   git clone https://github.com/Team-Thermocline/Controller.git
   # Navigate to the firmware directory
   cd Controller/Firmware

   # Create a build directory
   mkdir build && cd build
   # Build the firmware
   cmake ../
   make

Most tunables are set in `Firmware/include/constants.h <https://github.com/Team-Thermocline/Controller/blob/main/Firmware/include/constants.h>`_ and have the most descriptive comments to help guide what they will change.

.. _flashing-firmware:

Flashing Firmware
=================

You can flash the firmware to the controller by pressing the BOOT button on the controller while powering the machine
on **OR** you may use the `picotool <https://github.com/raspberrypi/picotool>`_. The controller will respond to picotool's requests to boot in bootloader mode.

.. code-block:: bash

   # Boot the controller in bootloader mode
   picotool reboot --bootloader
   # Flash the firmware
   picotool load Firmware/build/firmware.uf2

If in bootloader mode you may also drag and drop your built .uf2 file onto the controller to flash it.

HMI Touch Screen
================

The HMI Touch Screen is a Raspberry Pi 5 installed into the Decorational Panel at the front of the machine. The HMI 
touch screen is used to control the chamber and view the chamber data. It runs a simplified version of the website
stored locally and built on electron for ARM.

Building for the HMI Touch Screen is a bit more involved and hopefully not neccicary. You can find the documentation
for how to get started at `Team-Thermocline/ThermoclineHMI <https://github.com/Team-Thermocline/ThermoclineHMI>`_.

.. note:: The Pi Image available for download at `https://github.com/Team-Thermocline/ThermoclineHMI/releases/tag/v0.2 <https://github.com/Team-Thermocline/ThermoclineHMI/releases/tag/v0.2>`_ is intended for a overlayfs system. You will need to edit the partition mounting in firmware/boot/config.txt to make any changes.

Website
=======

The website is written in svelte and is entirely static so it can be hosted on github pages. Find the source code and build instructions here `Team-Thermocline/team-thermocline.github.io <https://github.com/Team-Thermocline/team-thermocline.github.io>`_.
