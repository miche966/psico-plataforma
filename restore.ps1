$path = "app/candidatos/page.tsx"
$content = [System.IO.File]::ReadAllText($path)

# 1. Eliminar bloque de cálculo
$pattern = '// C.*?LCULO ESPEC.*?FICO BIG FIVE(.|\n)*?b5Factors = \[\[.*?\]\]\s+\}'
$content = [regex]::Replace($content, $pattern, "")

# 2. Revertir lógia
$content = $content -replace 'if \(b5Factors\) \{', 'if (false) {'
$content = $content -replace 'testItems = b5Factors', 'testItems = []'

# 3. Saneamiento Mojibake
$replacements = @{
    'ÃƒÂ³' = 'ó'; 'ÃƒÂ¡' = 'á'; 'ÃƒÂ©' = 'é'; 'ÃƒÂ­' = 'í'; 'ÃƒÂº' = 'ú'; 'ÃƒÂ±' = 'ñ';
    'Ãƒâ€œ' = 'Ó'; 'Ãƒâ€˜' = 'Ñ'; 'Ã‚¿' = '¿'; 'ÃƒÂ' = 'Á'; 'Ã³' = 'ó'; 'Ã¡' = 'á';
    'Ã©' = 'é'; 'Ã­' = 'í'; 'Ãº' = 'ú'; 'Ã±' = 'ñ'; 'Â¿' = '¿'; 'Ãƒâ€' = 'Á'
}
foreach ($key in $replacements.Keys) {
    $content = $content.Replace($key, $replacements[$key])
}

# 4. Guardar
[System.IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Proceso completado"
