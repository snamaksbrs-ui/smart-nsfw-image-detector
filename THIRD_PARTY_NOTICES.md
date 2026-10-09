# THIRD PARTY NOTICES

This project builds on open-source software and model assets. The code and dependencies used here are selected for compatibility and legal reuse. The relevant upstream projects are listed below.

## 1. Falconsai/nsfw_image_detection

- Repository: https://github.com/Falconsai/nsfw_image_detection
- License: Apache License 2.0
- Use in this project: reference model choice for local and optional inference.
- Notes: This model is a strong open-source option for local NSFW image classification and is a good fit for privacy-centric deployment when hosted locally or in an on-prem environment.

## 2. nsfwjs

- Repository: https://github.com/infinitered/nsfwjs
- License: MIT License
- Use in this project: browser-side reference pattern and integration ideas for in-page image monitoring.
- Notes: Useful for understanding how browser-centered NSFW detection and blur overlays are implemented in JavaScript ecosystems.

## 3. Safe Content AI

- Repository: https://github.com/steelcityamir/safe-content-ai
- License: MIT License
- Use in this project: reference for a lightweight API wrapper and confidence threshold handling.
- Notes: Helpful as an architecture example for moderation APIs that score image safety levels and expose a confidence number.

## 4. OpenCV

- Repository: https://github.com/opencv/opencv
- License: Apache License 2.0
- Use in this project: optional image preprocessing and blur operations.
- Notes: This project uses OpenCV-based image processing patterns during preprocessing and Gaussian blur operations.

## 5. Transformers / Hugging Face

- Repository: https://github.com/huggingface/transformers
- License: Apache License 2.0
- Use in this project: optional local model loading and inference utilities.
- Notes: Used only for the optional model integration path and not required for the fallback classifier.

## Licence compliance

The project intentionally chooses permissive open-source dependencies and does not redistribute model weights or copyrighted media files without the relevant rights. If a deployment requires a stricter policy or a specific model license review, the operator should check the exact upstream licensing before shipping to production.
