@echo off
echo PyInstaller kuruluyor...
pip install pyinstaller

echo.
echo Program EXE'ye donusturuluyor...
:: Windows Defender ve diger antiviruslerin yanlis alarm (false positive) 
:: vermemesi icin --onefile (tek dosya) YERINE --onedir (klasor) yontemi kullanilmistir.
:: Tek dosya yapilan exe'ler arka planda temp klasorune dosya cikardigi icin virus sanilmaktadir.
pyinstaller --noconfirm --onedir --windowed --name "Monraido Picture Cutter" main.py

echo.
echo Islem tamamlandi! 
echo "dist\Monraido Picture Cutter" klasoru icindeki exe dosyasini kullanabilirsiniz.
pause
