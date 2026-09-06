import json
from pathlib import Path

from paddleocr import PaddleOCR


class OCREngine:
    def __init__(self):
        self.ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
        )

    def extract_text(self, image_path):
        results = self.ocr.predict(image_path)

        image_id = Path(image_path).stem

        text_blocks = []

        for result in results:
            texts = result["rec_texts"]
            scores = result["rec_scores"]
            boxes = result["rec_boxes"]

            for text, score, box in zip(texts, scores, boxes):
                text_blocks.append({
                    "text": text,
                    "bbox": box.tolist(),
                    "confidence": float(score)
                })

        return {
            "image_id": image_id,
            "ocr_engine": "PaddleOCR",
            "text_blocks": text_blocks
        }

    def save_result(self, image_path, output_dir="output"):
        result = self.extract_text(image_path)

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        image_id = result["image_id"]
        json_path = output_path / f"{image_id}_ocr.json"

        with open(json_path, "w", encoding="utf-8") as file:
            json.dump(result, file, indent=4)

        return json_path