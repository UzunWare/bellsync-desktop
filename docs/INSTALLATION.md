# BellSync Installation Guide

## For School IT Administrators

### Windows SmartScreen Warning

When installing BellSync for the first time, Windows may show a security warning:

> **"Windows protected your PC"**
> Microsoft Defender SmartScreen prevented an unrecognized app from starting.

This is normal for applications that are not commercially code-signed. BellSync is safe to install.

### How to Proceed

1. Click **"More info"** (small text link below the warning message)
2. Click **"Run anyway"**
3. The installer will proceed normally

This warning only appears on the **first installation**. Subsequent updates through the built-in auto-updater will not trigger it.

### Alternative: Whitelist via Group Policy

If your school uses managed Windows devices, you can whitelist BellSync:

- **Windows Defender Exclusion:** Add the BellSync installation path to Windows Defender exclusions
  - Default path: `C:\Users\<username>\AppData\Local\Programs\bellsync\`
- **Group Policy Deployment:** Deploy the installer via Group Policy to bypass SmartScreen for managed installs
- **Intune/SCCM:** Add BellSync to your approved applications list

### Data Storage

BellSync stores all settings (schedules, sounds, preferences) in:
```
%APPDATA%\bellsync\config.json
```

This location is separate from the application install directory. **Updates and reinstalls will never affect your saved data.**

### Backup

BellSync includes a built-in backup feature (Admin > Settings > Backup & Restore). We recommend exporting your settings after initial setup. The backup file (`.bellsync`) can be imported on any machine to restore your full configuration.

### Troubleshooting

If the app is not working correctly:

1. Open BellSync > Admin > Settings > **Open Log Folder**
2. Send the `main.log` file to your BellSync administrator
3. The log contains startup events, bell ring history, and error details

### System Requirements

- Windows 10 or later (64-bit)
- ~100 MB disk space
- No internet connection required for daily operation (only needed for auto-updates)
