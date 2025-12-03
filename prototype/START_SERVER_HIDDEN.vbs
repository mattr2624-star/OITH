Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""C:\Users\mattr\OneDrive\Desktop\Ross, Matt\Operations\MBA\OITH\prototype"" & python -m http.server 5500", 0, False
