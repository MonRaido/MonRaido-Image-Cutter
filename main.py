import sys
import os

# Ensure the core and gui packages can be imported
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from PyQt6.QtWidgets import QApplication
from PyQt6.QtGui import QImageReader
from gui.main_window import MainWindow

def main():
    app = QApplication(sys.path)
    QImageReader.setAllocationLimit(0)
    
    # Dark Theme Stylesheet
    app.setStyleSheet("""
        QMainWindow, QDialog, QMessageBox {
            background-color: #1e1e1e;
        }
        QLabel {
            color: #ffffff;
            font-size: 14px;
        }
        QPushButton {
            background-color: #3b3b3b;
            color: #ffffff;
            border: 1px solid #555555;
            padding: 8px 16px;
            border-radius: 4px;
        }
        QPushButton:hover {
            background-color: #4b4b4b;
        }
        QPushButton:pressed {
            background-color: #2b2b2b;
        }
        QPushButton:disabled {
            background-color: #2b2b2b;
            color: #777777;
        }
        QSpinBox {
            background-color: #3b3b3b;
            color: #ffffff;
            padding: 4px;
            border: 1px solid #555555;
        }
        QGraphicsView {
            background-color: #121212;
            border: none;
        }
    """)
    
    window = MainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
