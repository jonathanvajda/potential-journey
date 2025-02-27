//@ts-nocheck
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
const loadStatus = document.getElementById('loadStatus');

let db;
let ontologyObjects;
let selectedFile;

// Initialize IndexedDB
const request = indexedDB.open("dataMapperDB", 1);
request.onerror = (event) => {
    console.error("IndexedDB error:", event.target.errorCode);
};
request.onsuccess = (event) => {
    db = event.target.result;
    loadFileList();
};
request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("files", { keyPath: "name" });
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

// Fetch ontology objects
fetch('ontology-objects.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
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

function populateOntologySelect(select) {
    select.innerHTML = '';
    if (ontologyObjects) {
        ontologyObjects.forEach(obj => {
            const option = document.createElement('option');
            option.value = obj.IRI;
            option.textContent = obj.label;
            select.appendChild(option);
        });
    } else {
        select.innerHTML = '<option>Loading...</option>';
    }
}

fileInput.addEventListener('change', handleFileSelect);
loadButton.addEventListener('click', loadFileData);

function handleFileSelect(event) {
    const files = event.target.files;
    selectedFile = files[0];
    fileList.innerHTML = '';
    const listItem = document.createElement('li');
    listItem.textContent = selectedFile.name;
    fileList.appendChild(listItem);
    loadButton.disabled = !selectedFile;
}

function loadFileData() {
    if (!selectedFile) {
        alert("Please select a file first.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const fileData = e.target.result;
        let jsonData;
        const hasHeaders = hasHeadersCheckbox.checked;

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

            loadStatus.textContent = " ✅ File loaded!";
            loadStatus.style.color = "green";
        } catch (error) {
            console.error("File processing error:", error);
            loadStatus.textContent = " ❌ Error: " + error.message;
            loadStatus.style.color = "red";
        }
        loadFileList();
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
    const transaction = db.transaction(["files"], "readonly");
    const objectStore = transaction.objectStore("files");
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
        fileList.innerHTML = '';
        const files = event.target.result;
        files.forEach(file => {
            const listItem = document.createElement('li');
            listItem.textContent = file.name;
            fileList.appendChild(listItem);
        });
    };

    request.onerror = (event) => {
        console.error("Error loading file list:", event.target.error);
    };
}