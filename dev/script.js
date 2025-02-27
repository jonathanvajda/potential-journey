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
const loadStatus = document.getElementById('loadStatus'); // For status messages

let db; // IndexedDB database object
let ontologyObjects; // Store the ontology objects
let selectedFile;

// Initialize IndexedDB (same as before)
const dataDisplay = document.getElementById('dataDisplay');

// Initialize IndexedDB
const request = indexedDB.open("dataMapperDB", 1);
request.onerror = (event) => {
    console.error("IndexedDB error:", event.target.errorCode);
};
request.onsuccess = (event) => {
    db = event.target.result;
    loadFileList(); // Load previously uploaded files
};
request.onupgradeneeded = (event) => {
    db = event.target.result;
    const objectStore = db.createObjectStore("files", { keyPath: "name" });
};


// Tab switching logic (same as before)
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

// Fetch ontology objects (same as before)
fetch('ontology-objects.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Handle successful fetch (e.g., process data)
        // ...
    })
    .catch(error => {
        // Handle fetch error (e.g., log error)
        console.error("Error loading ontology objects:", error);
    });

// Tab switching logic (outside the fetch block)
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

// Fetch ontology objects (Improved handling)
fetch('ontology-objects.json')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`); // Check for HTTP errors
        }
        return response.json();
    })
    .then(data => {
        ontologyObjects = data;
        const existingSelects = document.querySelectorAll('#mappingContainer select:nth-child(2)'); // Select the ontology selects
        existingSelects.forEach(select => populateOntologySelect(select));
    })
    .catch(error => {
        console.error("Error loading ontology objects:", error);
        const errorSelects = document.querySelectorAll('#mappingContainer select:nth-child(2)');
        errorSelects.forEach(select => {
            select.innerHTML = '<option>Error loading ontology objects</option>';
        const errorSelects = document.querySelectorAll('#mappingContainer select:nth-child(2)'); // Select the ontology selects
        errorSelects.forEach(select => {
          select.innerHTML = '<option>Error loading ontology objects</option>';
            });
        });
    });

function populateOntologySelect(select) {
    select.innerHTML = ''; // Clear existing options
    if (ontologyObjects) {
        ontologyObjects.forEach(obj => {
            const option = document.createElement('option');
            option.value = obj.IRI;
            option.textContent = obj.label;
            select.appendChild(option);
        });
    } else {
        select.innerHTML = '<option>Loading...</option>'; // Keep loading message until data is fetched
    }
}

fileInput.addEventListener('change', handleFileSelect);
loadButton.addEventListener('click', loadFileData); // Added event listener

function handleFileSelect(event) {
    const files = event.target.files;
    selectedFile = files[0];
    fileList.innerHTML = '';
    const listItem = document.createElement('li');
    listItem.textContent = selectedFile.name;
    fileList.appendChild(listItem);
    loadButton.disabled = !selectedFile; // Disable if no file selected
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

            const transformedData = transformData(jsonData, hasHeaders); // Pass hasHeaders

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

function handleFileSelect(event) {
    const files = event.target.files;
    const errorLog = []; // Array to store error messages

    for (const file of files) {
        const reader = new FileReader();
        const listItem = document.createElement('li'); // Create list item for file
        listItem.textContent = file.name;
        fileList.appendChild(listItem); // Add to list immediately

        const statusSpan = document.createElement('span'); // Add status span
        listItem.appendChild(statusSpan);

        reader.onload = (e) => {
            const fileData = e.target.result;
            let jsonData;

            try {
                if (file.name.endsWith('.xlsx')) {
                    const workbook = XLSX.read(fileData, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                } else if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
                    jsonData = Papa.parse(fileData, { header: true, dynamicTyping: true }).data;
                } else {
                    throw new Error("Unsupported file type."); // Throw error for unsupported types
                }

                const transformedData = transformData(jsonData);

                // Store in IndexedDB
                const transaction = db.transaction(["files"], "readwrite");
                const objectStore = transaction.objectStore("files");
                objectStore.put({ name: file.name, data: transformedData });

                displayFileData(file.name, transformedData);

                statusSpan.textContent = " ✅ File loaded!"; // Success message
                statusSpan.style.color = "green";

            } catch (error) {
                console.error("File processing error:", error);
                errorLog.push({ file: file.name, error: error.message }); // Log the error
                statusSpan.textContent = " ❌ Error: " + error.message; // Error message
                statusSpan.style.color = "red";
            }
            loadFileList(); // Update file list in UI
        };

        reader.readAsBinaryString(file); // For XLSX
        //reader.readAsText(file); // For CSV/TSV
    }
}

function transformData(jsonData) {
    if (!jsonData || jsonData.length === 0) {
        return []; // Handle empty or invalid data
    }
    const headers = Object.keys(jsonData[0]);
    const transformedData = jsonData.map((row, index) => {
        const newRow = { id: index + 1 };
        headers.forEach(header => {
            newRow[header] = row[header];
        });
        return newRow;
    });
    return transformedData;
}

function displayFileData(fileName, jsonData) {
    dataTable.innerHTML = ''; // Clear previous data
    mappingContainer.innerHTML = ''; // Clear previous mapping inputs
    jsonDataDisplay.textContent = JSON.stringify(jsonData, null, 2); // Display JSON data

    if (!jsonData || jsonData.length === 0) {
        dataTable.innerHTML = "<p>No data available for this file.</p>";
        return;
    }

    // Display data as a table
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

    // Create mapping inputs (Improved Layout)
    headers.forEach(header => {
        const card = document.createElement('div');
        card.className = 'mapping-card';
        mappingContainer.appendChild(card);

        // Data Field Label
        const dataFieldLabel = document.createElement('label');
        dataFieldLabel.textContent = "Data Field:";
        card.appendChild(dataFieldLabel);

        // Header Label (Now displayed)
        const headerLabel = document.createElement('span');
        headerLabel.textContent = header;
        card.appendChild(headerLabel);

        // Example Label
        const exampleLabel = document.createElement('label');
        exampleLabel.textContent = "Example:";
        card.appendChild(exampleLabel);

        const exampleValue = document.createElement('span');
        exampleValue.className = 'example-value';
        const randomIndex = Math.floor(Math.random() * jsonData.length);
        exampleValue.textContent = jsonData[randomIndex][header];
        card.appendChild(exampleValue);

        // Type Label
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

        // Ontology Label
        const ontologyLabel = document.createElement('label');
        ontologyLabel.textContent = "Ontology Object:";
        card.appendChild(ontologyLabel);

        const ontologySelect = document.createElement('select');
        populateOntologySelect(ontologySelect); // Populate the select
        card.appendChild(ontologySelect);
    });
}


function loadFileList() {
    fileList.innerHTML = ''; // Clear existing list
    const transaction = db.transaction(["files"], "readonly");
    const objectStore = transaction.objectStore("files");
    objectStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const listItem = document.createElement('li');
            listItem.textContent = cursor.value.name;
            const deleteButton = document.createElement('button');
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener('click', () => {
                const deleteTransaction = db.transaction(["files"], "readwrite");
                const deleteObjectStore = deleteTransaction.objectStore("files");
                deleteObjectStore.delete(cursor.value.name);
                loadFileList(); // Refresh the list
                const fileDiv = document.getElementById(cursor.value.name);
                if (fileDiv) {
                  fileDiv.remove();
                }
                const headerDiv = document.getElementById("headerDisplay");
                headerDiv.innerHTML = "";
            });
            listItem.appendChild(deleteButton);
            fileList.appendChild(listItem);
            cursor.continue();
        }
    };
}

function displayHeaders() {
    headerDisplay.innerHTML = ''; // Clear previous headers

    const transaction = db.transaction(["files"], "readonly");
    const objectStore = transaction.objectStore("files");
    objectStore.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            const fileName = cursor.value.name;
            const jsonData = cursor.value.data;
            if (jsonData && jsonData.length > 0) {
                const headers = Object.keys(jsonData[0]);
    
                const headerList = document.createElement('ul');
                headerDisplay.appendChild(headerList);
    
                headers.forEach(header => {
                    const listItem = document.createElement('li');
                    listItem.textContent = header;
                    headerList.appendChild(listItem);
                });
            } else {
                const noHeadersMessage = document.createElement('p');
                noHeadersMessage.textContent = "No headers available for this file.";
                headerDisplay.appendChild(noHeadersMessage);
            }
            cursor.continue();
        }
    };
}