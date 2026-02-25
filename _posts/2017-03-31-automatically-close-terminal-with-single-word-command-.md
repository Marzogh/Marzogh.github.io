---
layout: post
author: Marzogh
title: Automatically exit Terminal cleanly with single command
categories: [tutorial, macOS, terminal, hack]
tags: [terminal, tutorial, macOS, hack, exit]
fullview: true
---

My Mac is my platform of choice for a lot of the stuff I do. However, one thing that has always bugged me is how when you type
``` shell
exit
```

into Terminal you see this:
![Terminal 'Exit'](/assets/media/Terminal_exit.png)

No more!

For those of you who have had enough of it as well, here's a solution.

<sub>
P.S. This is not for those of you who are not comfortable with the command line interface. You must have your terminal open and follow the following steps - changing some of the text as and when indicated.</sub>

<h3> Stage I - Basics</h3>
<h6> This will do the job </h6>

- Click on 'Terminal' in your status bar (next to the Apple logo) and click on 'Preferences'
- Select the 'Profiles' tab
- Click on the dropdown menu under 'When the shell exits:' and select 'Close if the shell exited cleanly'
![Terminal 'Preferences'](/assets/media/Terminal_pref.png)
- Close the 'Preferences' window
- That's that. From now on, if you type exit into your terminal, not only will it exit the process, it will close the window.

<h3> Stage II - Customization</h3>
<h6> If you'd like to add a bit more flair.... </h6>

- Open your .bash_profile by typing the following command into Terminal
``` shell
nano ~/.bash_profile
```
- Paste the following into your bash profile and save it.
``` shell
alias quit='osascript -e "do shell script \"osascript -e \\\"tell application \\\\\\\"Terminal\\\\\\\" to quit\\\" &> /dev/null &\""; exit'
```
- You can replace the word 'quit' with any other command of your choice.
- Now you can exit terminal and close the window at the same time using your own custom command!
