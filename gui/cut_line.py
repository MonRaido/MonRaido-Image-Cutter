from PyQt6.QtWidgets import QGraphicsLineItem, QGraphicsItem, QGraphicsSimpleTextItem
from PyQt6.QtGui import QPen, QColor, QPainterPath, QFont
from PyQt6.QtCore import Qt

class CutLine(QGraphicsLineItem):
    def __init__(self, y_pos, scene_width):
        super().__init__(0, y_pos, scene_width, y_pos)
        
        # Style the line (Red, Solid, thicker)
        pen = QPen(QColor(255, 0, 0))
        pen.setWidth(4)
        pen.setStyle(Qt.PenStyle.SolidLine)
        self.setPen(pen)
        
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsMovable, True)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemIsSelectable, True)
        self.setFlag(QGraphicsItem.GraphicsItemFlag.ItemSendsGeometryChanges, True)
        
        # Custom Z value so it stays above images
        self.setZValue(10)
        
        self.scene_width = scene_width

        # Text label to show distance
        self.label = QGraphicsSimpleTextItem(self)
        self.label.setBrush(QColor(255, 0, 0))
        font = QFont("Arial", 12, QFont.Weight.Bold)
        self.label.setFont(font)
        # Position label slightly above the line and on the left
        self.label.setPos(10, y_pos - 25)

    def set_label_text(self, text):
        self.label.setText(text)

    def shape(self):
        # Override shape to make it easier to click/select
        # Create a rectangular path around the line with a larger height
        path = QPainterPath()
        # Add a 20-pixel high rectangle around the line for easier grabbing
        path.addRect(0, self.line().y1() - 10, self.scene_width, 20)
        return path

    def itemChange(self, change, value):
        # Restrict movement to Y axis only
        if change == QGraphicsItem.GraphicsItemChange.ItemPositionChange:
            # value is a QPointF
            new_pos = value
            new_pos.setX(0) # Lock X axis
            return new_pos
        elif change == QGraphicsItem.GraphicsItemChange.ItemPositionHasChanged:
            if self.scene() and self.scene().views():
                view = self.scene().views()[0]
                if hasattr(view, 'update_line_labels'):
                    view.update_line_labels()
        return super().itemChange(change, value)
    
    def get_absolute_y(self):
        # The line was drawn at (0, original_y).
        # We need to add the item's Y offset if it has been moved.
        return self.line().y1() + self.pos().y()
