from src.ocr_engine import OCREngine


image_path = "input/product1.jpg"

ocr_engine = OCREngine()

text_blocks = ocr_engine.extract_text(image_path)

print("\nOCR RESULTS:")
print("=" * 50)

for block in text_blocks:
    print(f"Text: {block['text']}")
    print(f"Bounding Box: {block['bbox']}")
    print(f"Confidence: {block['confidence']}")
    print("-" * 50)