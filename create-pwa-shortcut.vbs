Dim shell, fso, projectDir, desktopDir, shortcutPath, launcherPath, shortcut
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopDir = shell.SpecialFolders("Desktop")
shortcutPath = fso.BuildPath(desktopDir, "Jira Notifications (Iniciar servicios).lnk")
launcherPath = fso.BuildPath(projectDir, "launch-pwa.vbs")
Set shortcut = shell.CreateShortcut(shortcutPath)
shortcut.TargetPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\wscript.exe")
shortcut.Arguments = Chr(34) & launcherPath & Chr(34)
shortcut.WorkingDirectory = projectDir
shortcut.Description = "Inicia Jira Notifications y sus servicios locales"
shortcut.Save
MsgBox "Se creo Jira Notifications (Iniciar servicios) en el escritorio. Ancla este acceso y desancla el acceso PWA anterior de Chrome.", 64, "Jira Notifications"
