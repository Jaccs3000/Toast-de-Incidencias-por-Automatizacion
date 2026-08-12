Dim shell, fso, scriptDir, powershellPath, updateScript, state, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
powershellPath = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
updateScript = fso.BuildPath(scriptDir, "update-windows-session.ps1")

If WScript.Arguments.Count < 1 Then
  WScript.Quit 2
End If

state = WScript.Arguments(0)
command = Chr(34) & powershellPath & Chr(34) & " -NoProfile -NonInteractive -File " & Chr(34) & updateScript & Chr(34) & " -State " & state
shell.Run command, 0, True
