---
layout: post
author: Marzogh
title: Eduroam on the Raspberry Pi
categories: [tutorial, raspberry pi]
tags: [eduroam, tutorial, wifi, setup, uq]
fullview: true
---

I've had to try and connect a Raspberry Pi to my work's eduroam a few times now, and each time I need to do it its just been long enough from when I'd last managed it that I don't remember enough and I end up working it all out again.

No more!

For all of you who are trying to connect to Eduroam networks on your Raspberry Pi, here's how you do it!

P.S. This is not for those of you who are not comfortable with the command line interface. You must have your terminal open and follow the following steps - changing some of the text as and when indicated.

<h3> Disable the network service </h3>
Type the following into terminal

``` shell
sudo service networking stop
```

<h3> Configure your wpa_supplicant file </h3>
 - In terminal type the following command
``` shell
sudo nano /etc/wpa_supplicant/wpa_supplicant.conf
```
If you are not comfortable working with nano, just replace the word nano in the previous command with leafpad - that should make it easy for those of you who are used to having a friendly GUI around.

 - Add the following section to the bottom of your wpa_supplicant.conf file

``` conf
network={
    # --- USER CONFIGURATION - YOU NEED TO SET THIS UP --

    # The 'identity' is your username used for authentication.
    # Some universities do not use the "@uni.domain.edu" at the end of their username, UQ does.
    # If you are unable to connect to WiFi when it is set up without the domain, try including it
    identity="abcde1@uq.edu.au"

    # Your normal university password (Make sure the permissions on
    # your wpa_supplicant.conf file are not set to publicly readable!!)
    password="12345"

    # You need a CA certificate. (Refer to the section just after this block of text for details)
    ca_cert="/etc/ssl/certs/uq-net-ca.pem"

    # -- ONLY CHANGE THE TEXT BELOW IF YOU KNOW YOUR UNIVERSITY --
    # -- USES DIFFERENT SETTINGS. IF LEFT AS IS, THESE SETTINGS --
    # -- SUPPORT MOST UNIVERSITIES - THESE SETTINGS ARE TESTED  --
    # -- TO WORK WITH THE UNIVERSITY OF QUEENSLAND, AUSTRALIA   --

    eap=PEAP TTLS

    # The 'anonymous_identity' is the identity used for routing
    # the authentication to UQ. It must end with '@uq.edu.au' and
    # must be all lowercase. If you have anything preceding the @
    # it must be all lowercase letters or a hyphen (no spaces
    # or any other punctuation).
    # e.g. "wireless-user@uq.edu.au" would be ok
    anonymous_identity="anonymous@uq.edu.au"

    # UQ uses MS-CHAPv2 as the inner authentication scheme,
    # with the common label
    phase1="peaplabel=0"
    phase2="auth=MSCHAPV2"

    # Set priority to a big number
    priority=777

    # --- DO NOT CHANGE ANY OF THE TEXT BELOW THIS LINE --

    # Enable this section
    disabled=0
    # Look for a network named 'eduroam'
    ssid="eduroam"
    # SSID will be broadcast, so no need to scan.
    scan_ssid=0
    # Infrastructure mode
    mode=0
    # WPA/WPA2 require OPEN
    auth_alg=OPEN
    # WPA and WPA2 (RSN) are both used for eduroam
    # (at the moment) In the future 'WPA' will be deprecated
    # and can be removed (this will make the eduroam network WPA2 only).
    proto=WPA RSN
    # CCMP (AES) is stronger, but some organisations use TKIP.
    # In the future TKIP will be dprecated and 'TKIP' can be removed.
    pairwise=CCMP TKIP
    # Use EAP
    key_mgmt=WPA-EAP
    # Use PMKSA caching
    proactive_key_caching=1
}
```

<h4> Getting a CA certificate </h4>
 - You should be able to get this from your university - just ask your IT department. For those of you from UQ, get the certificate here (Right click and Save Link As'): [UQ CA cert](/assets/downloads/uq-net-ca.pem)
 - Move the certificate that you just downloaded to /etc/ssl/certs/ by entering the following command in terminal. (DO NOT RENAME THE FILE!)

``` shell
sudo mv ~/Downloads/uq-net-ca.pem /etc/ssl/certs/uq-net-ca.pem
```

<h3> Restart wlan0 </h3>
- Once this is done, kickstart wpa_supplicant with the following command in terminal

``` shell
sudo wpa_supplicant -i wlan0 -c /etc/wpa_supplicant/wpa_supplicant.conf -B
```
