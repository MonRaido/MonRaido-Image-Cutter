import os
from PyQt6.QtGui import QImage, QPainter
from PyQt6.QtCore import QRect, Qt

def get_image_files(folder):
    """
    Returns a list of image files in the given folder, sorted alphabetically.
    """
    valid_exts = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}
    image_paths = []
    try:
        files = sorted(os.listdir(folder))
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in valid_exts:
                image_paths.append(os.path.join(folder, f))
    except Exception as e:
        print(f"Error reading folder: {e}")
    return image_paths

def cut_and_save_images(image_items, cut_coords, output_dir, img_format="PNG", quality=100):
    """
    Cuts the virtually stacked images at the given Y coordinates and saves them.
    image_items: list of tuples (path, item, y_offset)
    cut_coords: list of float/int absolute Y coordinates to cut at
    output_dir: directory to save the output images
    img_format: output format (PNG, JPG, WEBP)
    quality: output image quality (1-100)
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Sort cut coordinates and cast to int
    cuts = sorted([int(c) for c in cut_coords])
    
    # Ensure the cuts include the very top
    if not cuts or cuts[0] != 0:
        cuts.insert(0, 0)
        
    total_height = 0
    max_width = 0
    images_info = []
    
    # Read image sizes
    for path, item, y_offset in image_items:
        img = QImage(path)
        if img.isNull():
            continue
            
        w, h = img.width(), img.height()
        images_info.append({
            'path': path,
            'y_start': int(y_offset),
            'y_end': int(y_offset) + h,
            'width': w,
            'height': h
        })
        
        if w > max_width:
            max_width = w
        if int(y_offset) + h > total_height:
            total_height = int(y_offset) + h
            
    # Ensure the cuts include the very bottom
    if cuts[-1] < total_height:
        cuts.append(total_height)
        
    segment_index = 1
    # Iterate through the regions between cuts
    for i in range(len(cuts) - 1):
        y_top = cuts[i]
        y_bottom = cuts[i+1]
        
        segment_height = y_bottom - y_top
        if segment_height <= 0:
            continue
            
        # Create a new image for this segment
        segment_img = QImage(max_width, segment_height, QImage.Format.Format_ARGB32)
        segment_img.fill(Qt.GlobalColor.white)
        
        painter = QPainter(segment_img)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing, False)
        painter.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform, True)
        
        # Check which original images intersect with this segment
        for info in images_info:
            img_y_start = info['y_start']
            img_y_end = info['y_end']
            
            # Intersection logic
            if img_y_end > y_top and img_y_start < y_bottom:
                overlap_y_start = max(y_top, img_y_start)
                overlap_y_end = min(y_bottom, img_y_end)
                
                src_y = overlap_y_start - img_y_start
                src_height = overlap_y_end - overlap_y_start
                
                dest_y = overlap_y_start - y_top
                
                # Load source image to draw the required part
                src_img = QImage(info['path'])
                
                src_rect = QRect(0, src_y, info['width'], src_height)
                dest_rect = QRect(0, dest_y, info['width'], src_height)
                
                painter.drawImage(dest_rect, src_img, src_rect)
                
        painter.end()
        
        # Save the segmented image
        out_ext = img_format.lower()
        if out_ext == "jpeg": out_ext = "jpg"
        out_path = os.path.join(output_dir, f"{segment_index:03d}.{out_ext}")
        
        if img_format.upper() == "PNG":
            segment_img.save(out_path, "PNG")
        else:
            segment_img.save(out_path, img_format.upper(), quality)
            
        segment_index += 1
