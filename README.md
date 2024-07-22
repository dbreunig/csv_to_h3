# CSV H3 Tool

This is a lightweight tool for enriching a CSV with [H3][h3] tile IDs, at a user specified resolution, with or without each row's original coordinates.

Your original CSV must have columns labeled `lat` and `lon` for this tool to recognize the coordinate data. (I'll make that more forgiving in an forthcoming version...)

**Cluster with Aggregate Functions:** You can also use this tool to aggregate your records. Click the "Aggregate" button to apply summarization functions to numeric columns (like `sum`, `mean`, `median`, or `count`), generating statistics for each tile at the resolution you desire.

**A Tool for Masking Sensitive Data:** All data manipulated by this tool *doesn't leave your machine*. It is entirely private, making this tool perfect for rolling-up sensitive data (like movement data or household statistics) up to clustered H3 tile regions. Keep an eye on on the "Minimum points in a cell" figure at the bottom of the page to ensure you're at a resolution level adequate to mask an individual record.

**Remove Stray Records:** Sometimes your input data might have an outlier record you don't want in your final product. Click the red point you'd like to remove, then hit the "Remove Point" button.

[h3]: https://h3geo.org/