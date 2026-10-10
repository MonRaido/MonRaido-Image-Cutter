from PyQt6.QtWidgets import QGraphicsView, QGraphicsScene, QGraphicsPixmapItem
from PyQt6.QtCore import Qt, QPoint, QRectF, pyqtSignal
from PyQt6.QtGui import QPainter, QPixmap

class Canvas(QGraphicsView):
    line_requested = pyqtSignal(float)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.scene = QGraphicsScene(self)
        self.setScene(self.scene)
        
        self.setRenderHints(QPainter.RenderHint.Antialiasing | QPainter.RenderHint.SmoothPixmapTransform)
        self.setDragMode(QGraphicsView.DragMode.ScrollHandDrag)
        self.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        
        # Panning variables
        self._is_panning = False
        self._pan_start_pos = QPoint()
        
        self.add_line_mode = False
        
        # Track the loaded images and their Y offsets
        self.image_items = []
        self.total_height = 0
        self.max_width = 0

    def load_images(self, image_paths):
        """Loads a list of image paths and stacks them vertically in the scene."""
        self.scene.clear()
        self.image_items.clear()
        self.total_height = 0
        self.max_width = 0
        
        for path in image_paths:
            pixmap = QPixmap(path)
            if pixmap.isNull():
                continue
                
            item = QGraphicsPixmapItem(pixmap)
            item.setPos(0, self.total_height)
            self.scene.addItem(item)
            self.image_items.append((path, item, self.total_height))
            
            self.total_height += pixmap.height()
            if pixmap.width() > self.max_width:
                self.max_width = pixmap.width()
                
        self.scene.setSceneRect(QRectF(0, 0, self.max_width, self.total_height))
        self.fitInView(self.scene.sceneRect(), Qt.AspectRatioMode.KeepAspectRatio)

    def wheelEvent(self, event):
        """Zoom in/out with Ctrl+MouseWheel."""
        if event.modifiers() == Qt.KeyboardModifier.ControlModifier:
            zoom_in_factor = 1.15
            zoom_out_factor = 1 / zoom_in_factor
            
            if event.angleDelta().y() > 0:
                self.scale(zoom_in_factor, zoom_in_factor)
            else:
                self.scale(zoom_out_factor, zoom_out_factor)
        else:
            super().wheelEvent(event)

    def mousePressEvent(self, event):
        """Start panning on middle click or handle line adding."""
        if self.add_line_mode and event.button() == Qt.MouseButton.LeftButton:
            scene_pos = self.mapToScene(event.pos())
            self.line_requested.emit(scene_pos.y())
            self.add_line_mode = False
            self.setCursor(Qt.CursorShape.ArrowCursor)
            event.accept()
            return
            
        if event.button() == Qt.MouseButton.MiddleButton:
            self._is_panning = True
            self._pan_start_pos = event.pos()
            self.setCursor(Qt.CursorShape.ClosedHandCursor)
            event.accept()
        else:
            super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        """Handle panning."""
        if self._is_panning:
            delta = self._pan_start_pos - event.pos()
            self.horizontalScrollBar().setValue(self.horizontalScrollBar().value() + delta.x())
            self.verticalScrollBar().setValue(self.verticalScrollBar().value() + delta.y())
            self._pan_start_pos = event.pos()
            event.accept()
        else:
            super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        """Stop panning."""
        if event.button() == Qt.MouseButton.MiddleButton:
            self._is_panning = False
            self.setCursor(Qt.CursorShape.ArrowCursor)
            event.accept()
        else:
            super().mouseReleaseEvent(event)

    def update_line_labels(self):
        from gui.cut_line import CutLine
        cut_lines = []
        for item in self.scene.items():
            if isinstance(item, CutLine):
                cut_lines.append(item)
                
        cut_lines.sort(key=lambda line: line.get_absolute_y())
        
        prev_y = 0
        for line in cut_lines:
            curr_y = line.get_absolute_y()
            diff = curr_y - prev_y
            line.set_label_text(f"{int(diff)} px")
            prev_y = curr_y

    def keyPressEvent(self, event):
        if event.key() == Qt.Key.Key_Delete:
            selected_items = self.scene.selectedItems()
            if selected_items:
                for item in selected_items:
                    self.scene.removeItem(item)
                self.update_line_labels()
            event.accept()
        else:
            super().keyPressEvent(event)
