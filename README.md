# Dataset Directory

Place your lung CT scan and X-ray images in the following folder structure for training:

```
dataset/
├── train/
│   ├── cancer/       # Images with confirmed cancer
│   └── no_cancer/    # Healthy / no cancer images
└── val/
    ├── cancer/
    └── no_cancer/
```

## Supported Formats

- PNG, JPG, JPEG, GIF, BMP, TIFF, WebP

## Recommended Image Size

Images are automatically resized to **224×224** pixels during training and inference.

## Legacy DICOM Dataset

The original project used 3D DICOM lung scans with labels in `stage1_labels.csv`.
That CSV maps patient folder IDs to cancer labels (0 = no cancer, 1 = cancer).

To use the legacy dataset:
1. Download sample DICOM images from the [SharePoint link](https://qnm8.sharepoint.com/:f:/g/Ep5GUq573mVHnE3PJavB738Bevue4plkiXyNkYfxHI-a-A?e=UVMWne)
2. Convert DICOM slices to PNG/JPG and organize into the folder structure above
3. Run `python train.py` from the `model/` directory

## Demo Mode

If no images are present, running `python train.py` will automatically generate
a small synthetic dataset so you can test the full pipeline immediately.

## Label Reference

See `stage1_labels.csv` for the original 50-patient label mapping:

| Column | Description |
|--------|-------------|
| `id`   | Patient folder identifier |
| `cancer` | 0 = No Cancer, 1 = Cancer |
