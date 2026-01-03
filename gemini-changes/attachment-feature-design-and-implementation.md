# **SnapList Attachment System: Design & Implementation**

This document describes how SnapList handles photos and documents using the Firebase ecosystem.

## **1\. Architectural Strategy**

Because databases (Firestore) are inefficient for storing large binary data, we use a "Dual-Storage" pattern:

* **Firebase Storage:** Houses the actual files (Images, PDFs, etc.).  
* **Firestore:** Stores the "metadata" (URLs, filenames, and timestamps) as an array within the Task document.

## **2\. Data Schema Update**

### **Task Document (Firestore)**

Each task now contains an attachments array:

{  
  "title": "Fix the sink",  
  "attachments": \[  
    {  
      "id": "unique-uuid",  
      "name": "receipt.jpg",  
      "type": "image/jpeg",  
      "url": "https://firebasestorage...",  
      "storagePath": "artifacts/snaplist/users/uid/tasks/tid/attachments/receipt.jpg",  
      "createdAt": "ISOString"  
    }  
  \]  
}

## **3\. Storage Hierarchy**

Files are organized in the bucket to mirror the database structure, ensuring easy cleanup and clear ownership:  
artifacts/{appId}/users/{userId}/tasks/{taskId}/attachments/{fileName}

## **4\. Implementation Workflow**

### **A. Upload Process**

1. **User Action:** User clicks the "Attach File" button in the Detail View.  
2. **File Selection:** Standard browser file picker opens (accepting images and documents).  
3. **Storage Upload:** The app generates a reference to Firebase Storage and uploads the binary.  
4. **URL Retrieval:** Upon successful upload, the app retrieves a permanent "Download URL".  
5. **Database Update:** The app appends the attachment metadata to the attachments array in the Firestore task document.

### **B. Retrieval & Display**

* **Images:** Displayed as clickable thumbnails.  
* **Documents:** Displayed with generic file icons and names.  
* **Async Handling:** Since uploads take time, the UI provides a "loading" state per task to prevent users from closing the modal mid-upload.

### **C. Deletion Workflow**

Deletion is a two-step "clean sweep" to avoid orphaned files:

1. **Step 1:** Delete the file from **Firebase Storage** using the storagePath.  
2. **Step 2:** Remove the specific metadata object from the **Firestore** array.

## **5\. Security Rules (Targeted)**

Security is enforced at the Storage level:

match /artifacts/{appId}/users/{userId}/tasks/{taskId}/attachments/{fileName} {  
  allow read, write: if request.auth \!= null && request.auth.uid \== userId;  
}

### **Key Highlights of the Update:**

* **Resilient Uploads**: Uses `uploadBytesResumable` so we could easily add a percentage bar later if you want.  
* **Smart Metadata**: We store the `storagePath` in the task document. This is critical because it allows the app to find and delete the exact file in the cloud when you remove it from the task.  
* **Visual Context**: On the main task list, a small paperclip icon now appears next to the title of any task that has attachments, giving you a quick visual cue.  
* **Modern UI**: The detail modal now feels more like a native app with a sliding animation and touch-friendly file targets.

**Note for Local Migration**: When you move this locally, remember to enable **Cloud Storage** in your Firebase console and set your bucket rules to allow `read, write` for authenticated users. Otherwise, the uploads will fail with a "Permission Denied" error.

Exactly. The logic in the code is fully implemented—it handles the file selection, the background upload to Firebase Storage, the storage of the resulting URL in Firestore, and the final cleanup.

To make it work in your own environment, you just need to:

1. **Enable Storage** in the Firebase Console.  
2. **Set Security Rules** to allow your users to read/write to their own paths.  
3. **Configure the bucket URL** (which is usually included automatically in your `firebaseConfig`).

