

// Example HTML
const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Document</title>
</head>
<body>
    <div id="main" class="container">
        <h1>Hello, World!</h1>
        <p>This is a test paragraph.</p>
    </div>
</body>
</html>
`;

// Convert HTML to JSON
const jsonStructure = htmlToJson(html);

// Convert JSON back to HTML
const reconstructedHtml = jsonToHtml(jsonStructure);

console.log("JSON Structure:\n", JSON.stringify(jsonStructure, null, 2));
console.log("Reconstructed HTML:\n", reconstructedHtml);
