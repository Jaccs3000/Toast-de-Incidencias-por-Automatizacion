Dim shell, fso, projectDir, launcherPath, nodePath
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
launcherPath = fso.BuildPath(projectDir, "scripts\launch-pwa.mjs")
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%\nodejs\node.exe")
If Not fso.FileExists(nodePath) Then nodePath = "node.exe"
shell.CurrentDirectory = projectDir
shell.Run Chr(34) & nodePath & Chr(34) & " " & Chr(34) & launcherPath & Chr(34), 0, False
