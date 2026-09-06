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

        return text_blocks