Dim shell, fso, chromePath, edgePath, url, port, profilePath, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count < 3 Then
  WScript.Quit 2
End If

url = WScript.Arguments(0)
port = WScript.Arguments(1)
profilePath = WScript.Arguments(2)
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
If Not fso.FileExists(chromePath) Then
  chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
End If

If fso.FileExists(chromePath) Then
  command = Chr(34) & chromePath & Chr(34)
Else
  edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  If Not fso.FileExists(edgePath) Then
    edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  End If
  If Not fso.FileExists(edgePath) Then WScript.Quit 3
  command = Chr(34) & edgePath & Chr(34)
End If

command = command & " --remote-debugging-port=" & port _
  & " --remote-allow-origins=* --user-data-dir=" & Chr(34) & profilePath & Chr(34) _
  & " --no-first-run --no-default-browser-check " & Chr(34) & url & Chr(34)
shell.Run command, 1, False
