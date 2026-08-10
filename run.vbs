Dim shell, fso, scriptDir, batPath, logPath, logFile, message
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batPath = fso.BuildPath(scriptDir, "run.bat")
logPath = fso.BuildPath(scriptDir, "logs")
If Not fso.FolderExists(logPath) Then
  fso.CreateFolder(logPath)
End If
logFile = fso.BuildPath(logPath, "launcher.log")
message = Now & " | launching " & batPath
With fso.OpenTextFile(logFile, 8, True)
  .WriteLine message
  .Close
End With
Sub WriteLog(text)
  With fso.OpenTextFile(logFile, 8, True)
    .WriteLine Now & " | " & text
    .Close
  End With
End Sub
shell.CurrentDirectory = scriptDir
shell.Run Chr(34) & batPath & Chr(34), 0, False
WriteLog "run.bat launched with hidden CMD"

Dim http, startTime, frontendReady, chromePath, browserCommand
startTime = Timer
frontendReady = False

Do While Timer - startTime < 30
  On Error Resume Next
  Set http = CreateObject("WinHttp.WinHttpRequest.5.1")
  http.Open "GET", "http://127.0.0.1:5174", False
  http.Send
  frontendReady = (Err.Number = 0 And http.Status = 200)
  If frontendReady Then
    WriteLog "frontend health check succeeded with HTTP 200"
  Else
    WriteLog "frontend health check pending; HTTP status=" & http.Status & "; error=" & Err.Number
  End If
  Err.Clear
  On Error GoTo 0

  If frontendReady Then Exit Do
  WScript.Sleep 250
Loop

If frontendReady Then
  chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
  If Not fso.FileExists(chromePath) Then
    chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
  End If

  If fso.FileExists(chromePath) Then
    browserCommand = Chr(34) & chromePath & Chr(34) & " http://localhost:5174"
    WriteLog "opening Chrome with command: " & browserCommand
    On Error Resume Next
    shell.Run browserCommand, 1, False
    If Err.Number <> 0 Then
      WriteLog "Chrome launch failed; error=" & Err.Number & "; description=" & Err.Description
      Err.Clear
    End If
    On Error GoTo 0
  Else
    WriteLog "Chrome executable not found; opening URL with default browser"
    On Error Resume Next
    shell.Run "http://localhost:5174", 1, False
    If Err.Number <> 0 Then
      WriteLog "default browser launch failed; error=" & Err.Number & "; description=" & Err.Description
      Err.Clear
    End If
    On Error GoTo 0
  End If
Else
  WriteLog "browser was not opened because frontend did not become ready in 30 seconds"
End If
