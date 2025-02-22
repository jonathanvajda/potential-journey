const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const dataTable = document.getElementById('dataTable');
const mappingContainer = document.getElementById('mappingContainer');
const jsonDataDisplay = document.getElementById('jsonDataDisplay');
const headerDisplay = document.getElementById('headerDisplay');
const tabs = document.querySelectorAll('.tab');
const tabPanes = document.querySelectorAll('.tab-pane');
const loadButton = document.getElementById('loadButton');
const hasHeadersCheckbox = document.getElementById('hasHeaders');

let db; // IndexedDB database object
let ontologyObjects; // Store the ontology objects
let selectedFile; // Store the selected file

function getOntologyObjectsFromDB() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(["ontologyObjects"], "readonly");
        const objectStore = transaction.objectStore("ontologyObjects");
        const objects = [];
        objectStore.openCursor().onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
                objects.push(cursor.value);
                cursor.continue();
            } else {
                resolve(objects);
            }
        };
        objectStore.openCursor().onerror = reject;
    });
}

function loadOntologyObjectsIntoDB(data) {
    const transaction = db.transaction(["ontologyObjects"], "readwrite");
    const objectStore = transaction.objectStore("ontologyObjects");
    objectStore.clear();
    data.forEach(obj => objectStore.put(obj));
}

// Initialize IndexedDB
const request = indexedDB.open("dataMapperDB", 1);
request.onerror = (event) => {
    console.error("IndexedDB error:", event.target.errorCode);
};
request.onsuccess = (event) => {
    db = event.target.result;

    getOntologyObjectsFromDB()
        .then(objects => {
            if (objects.length > 0) {
                ontologyObjects = objects;
                const existingSelects = document.querySelectorAll('#mappingContainer select:nth-child(2)');
                existingSelects.forEach(select => populateOntologySelect(select));
            } else {
                fetch('ontology-objects.json')
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        return response.json();
                    })
                    .then(data => {
                        loadOntologyObjectsIntoDB(data);
                        ontologyObjects = data;
                        const existingSelects = document.querySelectorAll('#mappingContainer select:nth-child(2)');
                        existingSelects.forEach(select => populateOntologySelect(select));
                    })
                    .catch(error => {
                        console.error("Error loading ontology objects:", error);
                        const errorSelects = document.querySelectorAll('#mappingContainer select:nth-child(2)');
                        errorSelects.forEach(select => {
                            select.innerHTML = '<option>Error loading ontology objects</option>';
                        });
                    });
            }
        });
};
request.onupgradeneeded = (event) => {
    db = event.target.result;
    db.createObjectStore("files", { keyPath: "name" });
    db.createObjectStore("ontologyObjects", { keyPath: "IRI" }); // Add object store for ontology objects
};


// Tab switching logic
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));

        const targetPaneId = tab.dataset.tab;
        const targetPane = document.getElementById(targetPaneId);
        tab.classList.add('active');
        targetPane.classList.add('active');

        if (targetPaneId === 'headers') {
            displayHeaders();
        }
    });
});

// File input and load button handling
fileInput.addEventListener('change', handleFileSelect); // Only for file selection
loadButton.addEventListener('click', loadFileData);       // For loading and parsing

function handleFileSelect(event) {
    const files = event.target.files;
    selectedFile = files[0];
    fileList.innerHTML = '';
    const listItem = document.createElement('li');
    listItem.textContent = selectedFile.name;
    fileList.appendChild(listItem);

    // Enable the load button only when a file is selected
    loadButton.disabled = !selectedFile;
}

function loadFileData() {
    if (!selectedFile) {
        alert("Please select a file first.");
        return;
    }

    const reader = new FileReader();
    const listItem = document.querySelector('#fileList li');
    const statusSpan = document.createElement('span');
    listItem.appendChild(statusSpan);

    reader.onload = (e) => {
        const fileData = e.target.result;
        let jsonData;
        const hasHeaders = hasHeadersCheckbox.checked; // Get checkbox state

        try {
            if (selectedFile.name.endsWith('.xlsx')) {
                const workbook = XLSX.read(fileData, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                jsonData = XLSX.utils.sheet_to_json(worksheet, { header: hasHeaders ? 1 : undefined });
            } else if (selectedFile.name.endsWith('.csv') || selectedFile.name.endsWith('.tsv')) {
                jsonData = Papa.parse(fileData, { header: hasHeaders, dynamicTyping: true }).data;
            } else {
                throw new Error("Unsupported file type.");
            }

            const transformedData = transformData(jsonData, hasHeaders);

            const transaction = db.transaction(["files"], "readwrite");
            const objectStore = transaction.objectStore("files");
            objectStore.put({ name: selectedFile.name, data: transformedData });

            displayFileData(selectedFile.name, transformedData);

            statusSpan.textContent = " ✅ File loaded!";
            statusSpan.style.color = "green";

        } catch (error) {
            console.error("File processing error:", error);
            statusSpan.textContent = " ❌ Error: " + error.message;
            statusSpan.style.color = "red";
        }
        loadFileList(); // Update file list in UI
    };

    reader.readAsBinaryString(selectedFile);
}

function transformData(jsonData, hasHeaders) {
    if (!jsonData || jsonData.length === 0) {
        return [];
    }

    if (!hasHeaders) {
        return jsonData.map((row, index) => ({ id: index + 1, ...row }));
    }

    const headers = Object.keys(jsonData[0]);
    const transformedData = jsonData.slice(1).map((row, index) => {
        const newRow = { id: index + 1 };
        headers.forEach(header => {
            newRow[header] = row[header];
        });
        return newRow;
    });
    return transformedData;
}

function displayFileData(fileName, jsonData) {
    dataTable.innerHTML = '';
    mappingContainer.innerHTML = '';
    jsonDataDisplay.textContent = JSON.stringify(jsonData, null, 2);

    if (!jsonData || jsonData.length === 0) {
        dataTable.innerHTML = "<p>No data available for this file.</p>";
        return;
    }

    const table = document.createElement('table');
    dataTable.appendChild(table);

    const headers = Object.keys(jsonData[0]);
    const headerRow = table.insertRow();
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });

    jsonData.forEach(row => {
        const rowElement = table.insertRow();
        headers.forEach(header => {
            const cell = rowElement.insertCell();
            cell.textContent = row[header];
        });
    });

    headers.forEach(header => {
        const card = document.createElement('div');
        card.className = 'mapping-card';
        mappingContainer.appendChild(card);

        const dataFieldLabel = document.createElement('label');
        dataFieldLabel.textContent = "Data Field:";
        card.appendChild(dataFieldLabel);

        const headerLabel = document.createElement('span');
        headerLabel.textContent = header;
        card.appendChild(headerLabel);

        const exampleLabel = document.createElement('label');
        exampleLabel.textContent = "Example:";
        card.appendChild(exampleLabel);

        const exampleValue = document.createElement('span');
        exampleValue.className = 'example-value';
        const randomIndex = Math.floor(Math.random() * jsonData.length);
        exampleValue.textContent = jsonData[randomIndex][header];
        card.appendChild(exampleValue);

        const typeLabel = document.createElement('label');
        typeLabel.textContent = "Type:";
        card.appendChild(typeLabel);

        const typeSelect = document.createElement('select');
        typeSelect.innerHTML = `
            <option value="individual">Individual</option>
            <option value="class">Class</option>
            <option value="objectProperty">Object Relation</option>
            <option value="dataProperty">Data Property</option>
        `;
        card.appendChild(typeSelect);

        const ontologyLabel = document.createElement('label');
        ontologyLabel.textContent = "Ontology Object:";
        card.appendChild(ontologyLabel);

        const ontologySelect = document.createElement('select');
        populateOntologySelect(ontologySelect);
        card.appendChild(ontologySelect);
    });
}

function loadFileList() {
    fileList.innerHTML = '';
}