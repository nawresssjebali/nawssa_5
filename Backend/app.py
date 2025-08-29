import cv2
from flask import Flask, logging, request, jsonify, send_from_directory
from flask_cors import CORS  # 👈 very important for cross-origin requests
import joblib
import matplotlib
from matplotlib import transforms
import numpy as np
import time
from bs4 import BeautifulSoup
import openai
import torchvision.transforms as transforms
import pickle
from statistics import mean
from ragas.metrics import Faithfulness, ContextRelevance
from langdetect import detect, LangDetectException
from chromadb import PersistentClient
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.messages import SystemMessage, HumanMessage
from unstructured.documents.elements import NarrativeText, Text, Image, FigureCaption
from langchain_openai import ChatOpenAI, OpenAI
from base64 import b64decode
from unstructured.documents import elements
from llama_index.core.evaluation import CorrectnessEvaluator
# or FaithfulnessEvaluator, SemanticSimilarityEvaluator, etc.



import os
from flask import Response, stream_with_context

from openai import OpenAI
import requests 
import pickle
import traceback
from langchain.vectorstores import Chroma
from langchain.storage import InMemoryStore
from langchain.embeddings import OpenAIEmbeddings
from langchain.retrievers.multi_vector import MultiVectorRetriever
from langchain.schema.document import Document

from skimage import color, measure
from skimage.filters import threshold_otsu, gaussian
from skimage.transform import resize
import matplotlib.pyplot as plt
import os
from matplotlib.pyplot import imread
import re
import traceback 
matplotlib.use('Agg')
import tensorflow as tf
from IPython import display
display.clear_output()
from ultralytics import YOLO

from IPython.display import display, Image
import ultralytics
ultralytics.checks()
import torch
from werkzeug.utils import secure_filename
import torch.nn as nn
from langchain.retrievers.multi_vector import MultiVectorRetriever
from tensorflow.keras.models import load_model 

# Create Flask app
app = Flask(__name__)
CORS(app)
UPLOAD_FOLDER = '/diagnostic'
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
def predict_tensorflow(X):
    # Load the model
    model = tf.keras.models.load_model("resnet1d_ecg_model.h5")

    # Predict on your input X
    prediction = model.predict(X)
    predicted_class = np.argmax(prediction, axis=1)[0]

    print(f"🔍 TensorFlow Predicted class index: {predicted_class}")
    
    return predicted_class

class BetterCNN_LSTM(nn.Module):
    def __init__(self, num_classes=4):
        super(BetterCNN_LSTM, self).__init__()

        # Step 1: More expressive CNN layers to extract deep spatial features from the 13 leads
        self.cnn = nn.Sequential(
            nn.Conv1d(in_channels=13, out_channels=64, kernel_size=7, padding=3),  # Wider kernel for ECG patterns
            nn.ReLU(),
            nn.BatchNorm1d(64),
            nn.MaxPool1d(kernel_size=2),

            nn.Conv1d(64, 128, kernel_size=5, padding=2),
            nn.ReLU(),
            nn.BatchNorm1d(128),
            nn.MaxPool1d(kernel_size=2),

            nn.Conv1d(128, 256, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.BatchNorm1d(256),
            nn.Dropout(0.3),
        )

        # Step 2: Bidirectional LSTM for temporal pattern recognition over the 255 time steps
        self.lstm = nn.LSTM(input_size=256, hidden_size=128, batch_first=True, bidirectional=True)

        # Step 3: Fully connected layers for classification
        self.classifier = nn.Sequential(
            nn.Linear(128 * 2, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, num_classes)
        )

    def forward(self, x):  # x: (batch, 255, 13)
        x = x.permute(0, 2, 1)        # → (batch, 13, 255)
        x = self.cnn(x)               # → (batch, 256, ~63)
        x = x.permute(0, 2, 1)        # → (batch, ~63, 256)
        _, (hn, _) = self.lstm(x)     # hn: (2, batch, 128)
        hn = torch.cat((hn[0], hn[1]), dim=1)  # → (batch, 256)
        return self.classifier(hn)

# Function to check if the file has a valid extension
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_signal_leads(Leads, folder_name, parent):
    # Looping through image list containing all leads from 1-13
    for x, y in enumerate(Leads):
        # Creating subplot
        fig1, ax1 = plt.subplots()

        # Convert to grayscale
        grayscale = color.rgb2gray(y)

        # Smoothing image
        blurred_image = gaussian(grayscale, sigma=0.7)

        # Thresholding using Otsu method
        global_thresh = threshold_otsu(blurred_image)

        # Creating binary image
        binary_global = blurred_image < global_thresh

        # Resize image if not Lead 13
        if x != 12:
            binary_global = resize(binary_global, (300, 450))

        # Plot pre-processed image
        ax1.imshow(binary_global, cmap="gray")
        ax1.axis('off')
        ax1.set_title("Pre-processed Leads {} image".format(x + 1))
        plt.close('all')
        plt.ioff()

        # Save pre-processed image
        fig1.savefig('{parent}/{folder_name}/Lead_{x}_preprocessed_Signal.png'.format(
            folder_name=folder_name, x=x + 1, parent=parent))

        # Create figure for contour
        fig7, ax7 = plt.subplots()
        plt.gca().invert_yaxis()

        # Find contours and keep the most relevant one
        contours = measure.find_contours(binary_global, 0.8)
        contours_shape = sorted([c.shape for c in contours])[::-1][0:1]

        for contour in contours:
            if contour.shape in contours_shape:
                test = resize(contour, (255, 2))
                ax7.plot(test[:, 1], test[:, 0], linewidth=1, color='black')
                ax7.axis('image')
                ax7.set_title("Contour {} image".format(x + 1))

                # Save contour image
                plt.close('all')
                plt.ioff()
                fig7.savefig('{parent}/{folder_name}/Lead_{x}_Contour_Signal.png'.format(
                    folder_name=folder_name, x=x + 1, parent=parent))

                # Save or scale CSV
                lead_no = x
                # convert_csv(test, lead_no, folder_name, parent)
                # scale_csv(test, lead_no, folder_name, parent)
                scale_csv_1D(test, lead_no, folder_name, parent)
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import matplotlib.pyplot as plt
import os

def convert_csv(test, lead_no, folder_name, parent):
    # Convert contour to dataframe
    target = folder_name[0:2]
    df = pd.DataFrame(test, columns=['X', 'Y'])
    df['Target'] = target

    # Plot if needed (not used here, but fig created)
    fig5, ax5 = plt.subplots()
    plt.close('all')
    plt.ioff()

    # Convert to CSV
    df.to_csv(
        '{parent}/{folder_name}/{lead_no}.csv'.format(
            lead_no=lead_no + 1, parent=parent, folder_name=folder_name
        ),
        index=False
    )

def scale_csv(test, lead_no, folder_name, parent):
    # Scaling the data
    target = folder_name[0:2]
    scaler = MinMaxScaler()
    fit_transform_data = scaler.fit_transform(test)

    Normalized_Scaled = pd.DataFrame(fit_transform_data, columns=['X', 'Y'])
    Normalized_Scaled = Normalized_Scaled.T
    Normalized_Scaled['Target'] = target

    filename = '{parent}/Scaled_{lead_no}.csv'.format(lead_no=lead_no + 1, parent=parent)

    # Save scaled data
    if os.path.isfile(filename):
        Normalized_Scaled.to_csv(filename, mode='a', header=False)
    else:
        Normalized_Scaled.to_csv(filename)

def scale_csv_1D(test, lead_no, folder_name, parent):
    # Scaling only X axis
    target = folder_name[0:2]
    scaler = MinMaxScaler()
    fit_transform_data = scaler.fit_transform(test)

    Normalized_Scaled = pd.DataFrame(fit_transform_data[:, 0], columns=['X'])

    # Plot and save signal
    fig6, ax6 = plt.subplots()
    plt.gca().invert_yaxis()
    ax6.plot(Normalized_Scaled, linewidth=1, color='black', linestyle='solid')
    plt.close('all')
    plt.ioff()
    fig6.savefig(
        '{parent}/{folder_name}/ID_Lead_{lead_no}_Signal.png'.format(
            folder_name=folder_name, lead_no=lead_no + 1, parent=parent
        )
    )

    Normalized_Scaled = Normalized_Scaled.T
    Normalized_Scaled['Target'] = target

    filename = '{parent}/scaled_data_1D_{lead_no}.csv'.format(lead_no=lead_no + 1, parent=parent)

    # Save to CSV
    if os.path.isfile(filename):
        Normalized_Scaled.to_csv(filename, mode='a', header=False)
    else:
        Normalized_Scaled.to_csv(filename)
def extract_signal_leads(Leads, folder_name, parent):
    # Looping through image list containing all leads from 1–13
    for x, y in enumerate(Leads):
        # Create subplot
        fig1, ax1 = plt.subplots()

        # Convert to grayscale
        grayscale = color.rgb2gray(y)

        # Smooth the image
        blurred_image = gaussian(grayscale, sigma=0.7)

        # Thresholding to distinguish foreground from background using Otsu
        global_thresh = threshold_otsu(blurred_image)

        # Binary image based on threshold
        binary_global = blurred_image < global_thresh

        # Resize image for all except lead 13 (x = 12)
        if x != 12:
            binary_global = resize(binary_global, (300, 450))

        # Plot preprocessed binary image
        ax1.imshow(binary_global, cmap="gray")
        ax1.axis('off')
        ax1.set_title("Pre-processed Lead {} image".format(x + 1))
        plt.close('all')
        plt.ioff()

        # Save the preprocessed image
        fig1.savefig(
            '{parent}/{folder_name}/Lead_{x}_preprocessed_Signal.png'.format(
                folder_name=folder_name, x=x + 1, parent=parent
            )
        )

        # Prepare to extract contour
        fig7, ax7 = plt.subplots()
        plt.gca().invert_yaxis()

        # Find contour
        contours = measure.find_contours(binary_global, 0.8)
        contours_shape = sorted([c.shape for c in contours])[::-1][0:1]

        # Plot the contour signal
        for contour in contours:
            if contour.shape in contours_shape:
                test = resize(contour, (255, 2))
                ax7.plot(test[:, 1], test[:, 0], linewidth=1, color='black')
                ax7.axis('image')
                ax7.set_title("Contour {} image".format(x + 1))

                # Save contour image
                plt.close('all')
                plt.ioff()
                fig7.savefig(
                    '{parent}/{folder_name}/Lead_{x}_Contour_Signal.png'.format(
                        folder_name=folder_name, x=x + 1, parent=parent
                    )
                )

                # Use the scaled 1D CSV export
                lead_no = x
                scale_csv_1D(test, lead_no, folder_name, parent)
def Convert_Image_Lead(image_file, parent_folder):
    # Read the image
    image = imread(f'{parent_folder}/{image_file}')


    # Dividing the ECG leads from 1-13 from the above image
    Lead_1 = image[300:600, 150:643]
    Lead_2 = image[300:600, 646:1135]
    Lead_3 = image[300:600, 1140:1626]
    Lead_4 = image[300:600, 1630:2125]
    Lead_5 = image[600:900, 150:643]
    Lead_6 = image[600:900, 646:1135]
    Lead_7 = image[600:900, 1140:1626]
    Lead_8 = image[600:900, 1630:2125]
    Lead_9 = image[900:1200, 150:643]
    Lead_10 = image[900:1200, 646:1135]
    Lead_11 = image[900:1200, 1140:1626]
    Lead_12 = image[900:1200, 1630:2125]
    Lead_13 = image[1250:1480, 150:2125]

    # List of leads
    Leads = [Lead_1, Lead_2, Lead_3, Lead_4, Lead_5, Lead_6, Lead_7, Lead_8, Lead_9, Lead_10, Lead_11, Lead_12, Lead_13]

    # Folder name to store lead_images (remove '.jpg' extension)
    folder_name = re.sub('.jpg$', '', image_file)

    # Create folder if not exists
    folder_path = os.path.join(parent_folder, folder_name)
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

    # Loop through leads and create separate images
    for x, y in enumerate(Leads):
        fig, ax = plt.subplots()
        ax.imshow(y)
        ax.axis('off')
        ax.set_title("Lead {0}".format(x + 1))
        plt.close('all')
        plt.ioff()

        # Save the lead image
        fig.savefig('{parent}/{folder_name}/Lead_{x}_Signal.png'.format(
            folder_name=folder_name,
            x=x + 1,
            parent=parent_folder
        ))

    # Call function to extract signals from the leads
    extract_signal_leads(Leads, folder_name, parent_folder)
import os
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import matplotlib.pyplot as plt

def convert_csv(test, lead_no, folder_name, parent):
    # Convert contour to dataframe
    target = folder_name[0:2]
    df = pd.DataFrame(test, columns=['X', 'Y'])
    df['Target'] = target

    # Optional plotting - uncomment if needed
    # fig5, ax5 = plt.subplots()
    # ax5.plot(df['X'], df['Y'])
    # plt.close(fig5)

    # Convert to CSV
    csv_path = '{parent}/{folder_name}/{lead_no}.csv'.format(lead_no=lead_no+1, parent=parent, folder_name=folder_name)
    df.to_csv(csv_path, index=False)
import os
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import matplotlib.pyplot as plt

def scale_csv_1D(test, lead_no, folder_name, parent):
    target = folder_name[0:2]
    # Scaling the data and testing
    scaler = MinMaxScaler()
    fit_transform_data = scaler.fit_transform(test)

    Normalized_Scaled = pd.DataFrame(fit_transform_data[:, 0], columns=['X'])

    fig6, ax6 = plt.subplots()
    plt.gca().invert_yaxis()
    ax6.plot(Normalized_Scaled, linewidth=1, color='black', linestyle='solid')
    plt.close(fig6)
    plt.ioff()

    # Save the plot image
    img_path = '{parent}/{folder_name}/ID_Lead_{lead_no}_Signal.png'.format(
        folder_name=folder_name,
        lead_no=lead_no+1,
        parent=parent
    )
    fig6.savefig(img_path)

    Normalized_Scaled = Normalized_Scaled.T
    Normalized_Scaled['Target'] = target

    csv_path = '{parent}/scaled_data_1D_{lead_no}.csv'.format(
        lead_no=lead_no+1,
        parent=parent
    )

    if os.path.isfile(csv_path):
        Normalized_Scaled.to_csv(csv_path, mode='a', header=False)
    else:
        Normalized_Scaled.to_csv(csv_path, mode='w', header=True)
import os
import gc
import matplotlib.pyplot as plt
from skimage import color, measure
from skimage.filters import threshold_otsu, gaussian
from skimage.transform import resize
import pandas as pd

def extract_signal_leads(Leads, folder_name, parent):
    output_dir = os.path.join(parent, folder_name)
    os.makedirs(output_dir, exist_ok=True)
    print(f"[INFO] Output folder created: {output_dir}")

    for x, y in enumerate(Leads):
        lead_name = f"Lead_{x + 1}"
        csv_output = os.path.join(output_dir, f"{lead_name}_scaled.csv")
        if os.path.exists(csv_output):
            print(f"[SKIP] Already processed: {csv_output}")
            continue

        try:
            print(f"\n[INFO] Processing {lead_name}...")

            # Convert to grayscale
            grayscale = color.rgb2gray(y)
            print("[DEBUG] Converted to grayscale.")

            # Blur the image
            blurred_image = gaussian(grayscale, sigma=0.7)
            print("[DEBUG] Applied Gaussian blur.")

            # Apply thresholding
            global_thresh = threshold_otsu(blurred_image)
            binary_global = blurred_image < global_thresh
            print("[DEBUG] Applied Otsu thresholding.")

            if x != 12:
                binary_global = resize(binary_global, (300, 450))
                print("[DEBUG] Resized binary image.")

            # Save preprocessed image
            preproc_path = os.path.join(output_dir, f"{lead_name}_preprocessed_Signal.png")
            fig1, ax1 = plt.subplots()
            ax1.imshow(binary_global, cmap="gray")
            ax1.axis('off')
            ax1.set_title(f"Pre-processed {lead_name}")
            fig1.savefig(preproc_path)
            plt.close(fig1)
            print(f"[INFO] Saved preprocessed image: {preproc_path}")

            # Find contours
            contours = measure.find_contours(binary_global, 0.8)
            if not contours:
                print("[WARNING] No contours found.")
                continue

            contours_shape = sorted([c.shape for c in contours])[::-1][0:1]
            fig7, ax7 = plt.subplots()
            plt.gca().invert_yaxis()

            for contour in contours:
                if contour.shape in contours_shape:
                    test = resize(contour, (255, 2))
                    ax7.plot(test[:, 1], test[:, 0], linewidth=1, color='black')
                    ax7.axis('image')
                    ax7.set_title(f"Contour {lead_name}")
                    contour_path = os.path.join(output_dir, f"{lead_name}_Contour_Signal.png")
                    fig7.savefig(contour_path)
                    plt.close(fig7)
                    print(f"[INFO] Saved contour image: {contour_path}")

                    # Save CSV
                    scale_csv_1D(test, x, folder_name, parent)

                    # Optional: Save visualization instead of showing it
                    visualize_csv(x, folder_name, parent)
                    break  # Only one main contour

        except Exception as e:
            print(f"[ERROR] Error in {lead_name}: {e}")
        finally:
            gc.collect()

def scale_csv_1D(test, lead_no, folder_name, parent):
    min_vals = test.min(axis=0)
    max_vals = test.max(axis=0)
    diff = max_vals - min_vals
    diff[diff == 0] = 1  # Avoid division by zero
    test_scaled = (test - min_vals) / diff

    df = pd.DataFrame(test_scaled, columns=['X', 'Y'])
    csv_path = os.path.join(parent, folder_name, f"Lead_{lead_no + 1}_scaled.csv")
    df.to_csv(csv_path, index=False)
    print(f"[INFO] Saved scaled CSV: {csv_path}")

def visualize_csv(lead_no, folder_name, parent):
    csv_path = os.path.join(parent, folder_name, f"Lead_{lead_no + 1}_scaled.csv")
    if not os.path.exists(csv_path):
        print(f"[ERROR] CSV file not found for Lead {lead_no + 1}")
        return

    df = pd.read_csv(csv_path)
    fig, ax = plt.subplots()
    ax.plot(df['X'], df['Y'], linewidth=1, color='blue')
    ax.set_title(f"Lead {lead_no + 1} Scaled CSV Signal")
    ax.set_xlabel("X (Normalized)")
    ax.set_ylabel("Y (Normalized)")
    ax.grid(True)

    img_path = os.path.join(parent, folder_name, f"Lead_{lead_no + 1}_CSV_Visualization.png")
    fig.savefig(img_path)
    plt.close(fig)
    print(f"[INFO] Saved CSV visualization: {img_path}")
# Read log file (to avoid reprocessing files)
def load_log(log_path):
    if os.path.exists(log_path):
        return set(pd.read_csv(log_path)['filename'].tolist())
    return set()

# Update the log with processed file names
def update_log(log_path, processed_files):
    df = pd.DataFrame({'filename': list(processed_files)})
    df.to_csv(log_path, index=False)


root_path = "/diagnostic"  # The directory where files will be saved
log_path = "/diagnostic/single_image_log.csv"  # Log file to avoid double processing
  # Output path for cleaned CSVs

# Dictionary to store cumulative data per lead number
data_per_lead = {}
def get_file_path(file_name, folder_path):
    return os.path.join(folder_path, file_name)
# Your route for handling the image and processing CSVs
# Process the uploaded image to extract leads
def process_image(uploaded_image_path):
    folder_path = os.path.dirname(uploaded_image_path)
    filename = os.path.basename(uploaded_image_path)

    log_path = "/diagnostic/single_image_log.csv"  # Log path to track processed images
    processed = load_log(log_path)

    # Skip processing if already processed
    if filename in processed:
        print(f"[INFO] {filename} already processed.")
    else:
        try:
            # Convert image to leads (this is a placeholder function you should define)
            Convert_Image_Lead(filename, folder_path)
            processed.add(filename)
            print(f"[✓] {filename} processed.")
            update_log(log_path, processed)
            print(f"[INFO] Log updated.")
        except Exception as e:
            print(f"[ERROR] Failed to process {filename}: {e}")

        gc.collect()  # Clean up memory after processing


# Process the CSV files for each lead and combine the data
def process_csvs():
    root_path = "/diagnostic"  # The directory where the data is stored
    output_path = root_path  # Save the combined CSVs back to the same directory

    data_per_lead = {}  # Dictionary to store cumulative data for each lead

    for folder in os.listdir(root_path):
        folder_path = os.path.join(root_path, folder)
        if not os.path.isdir(folder_path):
            continue  # Skip non-folder files

        label = folder[:2]  # Extract the label (first two characters of folder name)

        for file in os.listdir(folder_path):
            if re.match(r"Lead_\d+_scaled\.csv", file):
                lead_no = re.findall(r"Lead_(\d+)_scaled\.csv", file)[0]
                csv_path = os.path.join(folder_path, file)

                try:
                    # Read the CSV file for this lead
                    df = pd.read_csv(csv_path, header=None, index_col=None)

                    # Extract X values (the first column in each CSV file)
                    x_values = df[0].values  # numpy array shape (255,)

                    # Append label to the data (this is the target for classification)
                    row_with_label = list(x_values) + [label]

                    # Initialize list for the lead if not already done
                    if lead_no not in data_per_lead:
                        data_per_lead[lead_no] = []

                    # Add this row to the cumulative data for the lead
                    data_per_lead[lead_no].append(row_with_label)

                except Exception as e:
                    print(f"[!] Error processing {csv_path}: {e}")

    # Save each lead's combined data to a CSV
    for lead_no, rows in data_per_lead.items():
        df_final = pd.DataFrame(rows)

        # Set column names: 0 to 254 for features, and 'target' for the label
        df_final.columns = [str(i) for i in range(df_final.shape[1] - 1)] + ["target"]

        output_file = f"scaled_data_1D_{lead_no}.csv"
        output_file_path = os.path.join(output_path, output_file)

        # Save the combined CSV file
        df_final.to_csv(output_file_path, index=False)
        print(f"[✓] Saved combined CSV: {output_file_path}")


# Clean the CSV files (drop columns as needed)
def clean_csvs():
    root_path = "/diagnostic"  # Directory where the data is stored

    for lead_no in range(1, 14):
        file_path = os.path.join(root_path, f"scaled_data_1D_{lead_no}.csv")
        df = pd.read_csv(file_path)

        # Drop the first column (usually the index or 'X' values)
        df = df.drop(columns=[df.columns[0]])

        # Rename columns to numeric indices starting from 0
        df.columns = range(df.shape[1])

        # Drop the last column (usually the 'target' label column)
        df = df.drop(columns=[df.columns[-1]])

        # Save the cleaned data (overwrite the original file)
        df.to_csv(file_path, index=False)

        print(f"Lead {lead_no} cleaned and saved.")


# Stack lead data to model-ready format
def stack_lead_data():
    lead_data = []  # List to hold features for each lead

    for lead_no in range(1, 14):
        file_path = os.path.join("/diagnostic", f"scaled_data_1D_{lead_no}.csv")
        df = pd.read_csv(file_path)

        # Flatten the data (flattening from (255, 1) to (255,))
        lead_features = df.astype(float).values.flatten()
        print(f"Lead {lead_no} features shape: {lead_features.shape}")

        lead_data.append(lead_features)

    # Stack the lead data into a single array of shape (255, 13)
    X = np.stack(lead_data, axis=1)

    # Add batch dimension → (1, 255, 13)
    X = np.expand_dims(X, axis=0)

    print("✅ Final input shape:", X.shape)
    return X

import torch

def predict_model(X):
    # Load the model (make sure the model definition is correct and loaded)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    # Instantiate the model (you need to define or import BetterCNN_LSTM class)
    model = BetterCNN_LSTM()

    # Load the model weights
    model.load_state_dict(torch.load("best_model (1).pth", map_location=device))

    model.to(device)
    model.eval()

    # Convert input X to tensor
    X_tensor = torch.tensor(X, dtype=torch.float32).to(device)

    # Make prediction without updating gradients
    with torch.no_grad():
        outputs = model(X_tensor)
        predicted_label = outputs.argmax(dim=1).item()

    print(f"🧠 PyTorch Predicted class index: {predicted_label}")
    
    return predicted_label  # Return only the numeric class index
def predict_with_models(X):
    """
    Extract features using the feature extractor model and make predictions using the stacking model.

    Args:
    - X: Input data with shape (1, 255, 13)

    Returns:
    - y_pred_loaded: The prediction from the stacking model
    """
    
    # Load the feature extractor model (CNN)
    feature_extractor = load_model('cnn_feature_extractor_model.h5')

    # Use input data X to extract features
    features = feature_extractor.predict(X)

    print("Extracted features shape:", features.shape)  # Expected: (1, 64)
    print("Extracted features vector:", features)

    # Load the stacking model (e.g., a classifier)
    stacking_model = joblib.load('stacking_model_test.pkl')

    # Make the final prediction using the stacking model
    y_pred_loaded = stacking_model.predict(features)

    print("Prediction:", y_pred_loaded)

    return y_pred_loaded 
def cleanup_diagnostic_directory():
    """
    Deletes all files and directories in the /diagnostic directory.
    Logs detailed information about each file or directory being deleted.
    """
    directory_path = "/diagnostic"
    
    # Check if the diagnostic directory exists
    if os.path.exists(directory_path):
        print(f"Starting cleanup of the {directory_path} directory.")
        
        # Loop through the files and directories inside the directory
        for filename in os.listdir(directory_path):
            file_path = os.path.join(directory_path, filename)
            
            # Try to delete each file or directory
            try:
                if os.path.isdir(file_path):
                    shutil.rmtree(file_path)  # Delete a directory and all its contents
                    print(f"✅ Directory {file_path} deleted successfully.")
                else:
                    os.remove(file_path)  # Delete a file
                    print(f"✅ File {file_path} deleted successfully.")
            except Exception as e:
                print(f"❌ Error deleting {file_path}: {e}")
        
        # Indicate that cleanup is complete
        print(f"Cleanup of {directory_path} completed.")
        
    else:
        print(f"⚠️ Directory {directory_path} does not exist.")

import os
import shutil
import joblib
import numpy as np

def predict_with_stacking_model(X):
    """
    This function performs PCA transformation on the input data and then predicts using the stacking model.
    
    Parameters:
    - X: Input data (numpy array) to be transformed and predicted.
    
    Returns:
    - y_pred: The predicted class label(s) from the stacking model.
    """
    try:
        # Reshape X to be flat (if necessary)
        X_flat = X.reshape(X.shape[0], -1)  # Flatten the data if it's multi-dimensional
        
        # Load the PCA model using joblib
        pca = joblib.load('pca_finale.pkl')
        
        # Transform the data using PCA
        X_pca = pca.transform(X_flat)
        
        # Load the stacking model using joblib
        stacking_model = joblib.load('best_model_tml_1.pkl')
        
        # Make predictions using the stacking model
        y_pred_loaded = stacking_model.predict(X_pca)
        
        print("Prediction:", y_pred_loaded)
        
        return y_pred_loaded  # Return the prediction
    
    except Exception as e:
        print(f"Error occurred: {e}")
        return None


import subprocess

import subprocess

import subprocess

import subprocess
import os
import subprocess

import os
import subprocess

import os
import subprocess

import os
import subprocess

import os
import subprocess

import os
import subprocess
import re
from ultralytics import YOLO

def predict_with_yolo(image_path, conf_threshold=0.25, model_path="best (4).pt"):
    # Define the label map (you can adjust this as per your actual classes)
    label_map = {
        "Normal ecg": 0,
        "MI": 1,
        "RMI": 2,
        "AHB": 3
    }
    
    # Load the YOLO model
    model = YOLO(model_path)

    try:
        # Make prediction on the single image
        results = model.predict(source=image_path, conf=conf_threshold, task='classify')
        
        # Get the predicted class name
        class_name = results[0].names[results[0].probs.top1]
        
        # Encode the class name to its corresponding numeric label
        encoded_label = label_map.get(class_name, None)
        
        if encoded_label is not None:
            return encoded_label
        else:
            print(f"❌ Class name '{class_name}' not found in the label map.")
            return None
    
    except Exception as e:
        print(f"❌ Erreur pour l'image : {image_path} --> {e}")
        return None




from collections import Counter
from flask import jsonify, request
import os
import shutil
from werkzeug.utils import secure_filename

def apply_grad_cam(image_path: str, model_path="best (4).pt"):
    """
    Applies Grad-CAM to an image using a trained YOLOv8 model.
    
    Parameters:
    - image_path (str): Path to the input image.
    - model_path (str): Path to the trained YOLOv8 model.
    
    Returns:
    - None (Displays the Grad-CAM output)
    """
    # Load the trained YOLOv8 model
    model = YOLO(model_path)
    model = model.model.eval()  # Set to evaluation mode

    # Preprocessing function
    transform = transforms.Compose([transforms.ToTensor()])

    # Load the image
    original_image = cv2.imread(image_path)
    original_image = cv2.cvtColor(original_image, cv2.COLOR_BGR2RGB)
    input_tensor = transform(original_image)
    input_tensor = input_tensor.unsqueeze(0)  # Add batch dimension

    # Make sure the tensor requires gradients
    input_tensor.requires_grad_()

    # Grad-CAM hooks
    feature_maps = []
    gradients = []

    def forward_hook(module, input, output):
        feature_maps.append(output)

    def backward_hook(module, grad_input, grad_output):
        gradients.append(grad_output[0])  # Store gradients

    # Find the target layer (last convolutional layer)
    target_layer = None
    for layer in reversed(list(model.model.children())):
        if isinstance(layer, nn.Sequential):
            for sublayer in reversed(list(layer.children())):
                if hasattr(sublayer, 'cv2'):
                    target_layer = sublayer.cv2.conv
                    target_layer.register_full_backward_hook(backward_hook)  # Full backward hook
                    target_layer.register_forward_hook(forward_hook)  # Forward hook
                    break
        elif hasattr(layer, 'cv2'):
            target_layer = layer.cv2.conv
            target_layer.register_full_backward_hook(backward_hook)
            target_layer.register_forward_hook(forward_hook)
            break
    if target_layer is None:
        raise ValueError("No suitable layer with cv2 found!")

    # Forward pass to get the output
    output = model(input_tensor)
    logits = output[0]  # Take the first item: the classification logits
    predicted_class = logits.argmax(dim=1)  # Get the predicted class

    # Backward pass for Grad-CAM
    model.zero_grad()
    one_hot = torch.zeros_like(logits)
    one_hot[0][predicted_class] = 1
    logits.requires_grad_()
    logits.backward(gradient=one_hot, retain_graph=True)

    # Get gradients and feature maps
    if gradients:
        gradients = gradients[0]  # Get the stored gradients
    if feature_maps:
        activations = feature_maps[0].detach()

    # Average the gradients spatially
    pooled_gradients = torch.mean(gradients, dim=[0, 2, 3])

    # Weight the channels with the pooled gradients
    for i in range(activations.shape[1]):
        activations[:, i, :, :] *= pooled_gradients[i]

    # Generate the heatmap
    heatmap = torch.mean(activations, dim=1).squeeze()  # Average over channels
    heatmap = np.maximum(heatmap.cpu().numpy(), 0)  # Apply ReLU
    heatmap /= np.max(heatmap)  # Normalize

    # Resize the heatmap to match the input image
    heatmap = cv2.resize(heatmap, (original_image.shape[1], original_image.shape[0]))
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

    # Superimpose the heatmap onto the original image
    superimposed_img = cv2.addWeighted(cv2.cvtColor(original_image, cv2.COLOR_RGB2BGR), 0.6, heatmap, 0.4, 0)

    # Save the Grad-CAM output image to the static folder
    grad_cam_output_path = os.path.join('static', 'grad_cam_output.jpg')
    cv2.imwrite(grad_cam_output_path, cv2.cvtColor(superimposed_img, cv2.COLOR_BGR2RGB))

    # Display the results
    plt.figure(figsize=(10, 10))
    plt.imshow(cv2.cvtColor(superimposed_img, cv2.COLOR_BGR2RGB))
    plt.axis('off')
    plt.title(f"Grad-CAM Heatmap - Predicted Class: {predicted_class.item()}")
    plt.show()

    return grad_cam_output_path

@app.route('/predict', methods=['POST'])
def predict():
    start_time = time.time()  # Start timing here

    cleanup_diagnostic_directory()

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)

        try:
            if not os.path.exists(app.config['UPLOAD_FOLDER']):
                os.makedirs(app.config['UPLOAD_FOLDER'])

            file.save(file_path)
            print(f"File saved at: {file_path}")

            grad_cam_output_path = apply_grad_cam(image_path=file_path, model_path="best (4).pt")
            print(f"Grad-CAM output saved at: {grad_cam_output_path}")

            nawress_5 = predict_with_yolo(file_path)
            process_image(file_path)
            process_csvs()
            clean_csvs()
            stacked_data = stack_lead_data()

            print(f"Stacked data shape: {stacked_data.shape}")

            custom_class = predict_model(stacked_data)
            tf_class = predict_tensorflow(stacked_data)
            model = predict_with_models(stacked_data)
            model_4 = predict_with_stacking_model(stacked_data)

            nawress = model[0]
            nawress_1 = model_4[0]
            print(f"✅ Custom Model Predicted class: {custom_class}")
            print(f"✅ TensorFlow Model Predicted class: {tf_class}")
            print(f"✅ Predicted class with third model: {nawress}")
            print(f"✅ Predicted class with fourth model: {nawress_1}")
            print(f"✅ Predicted class with last model: {nawress_5}")

            custom_class = int(custom_class)
            tf_class = int(tf_class)
            nawress = int(nawress)
            nawress_1 = int(nawress_1)
            nawress_5 = int(nawress_5)

            predictions = [custom_class, tf_class, nawress, nawress_1, nawress_5]
            prediction_counts = Counter(predictions)
            most_common_class, most_common_count = prediction_counts.most_common(1)[0]

            if list(prediction_counts.values()).count(most_common_count) > 1:
                final_class = nawress_5
            else:
                final_class = most_common_class

            folder_path = os.path.dirname(file_path)
            if os.path.exists(folder_path):
                shutil.rmtree(folder_path)
                print(f"Folder {folder_path} deleted after processing.")

            input_shape_list = list(stacked_data.shape)
            print(f"✅ final: {final_class}")

            end_time = time.time()
            response_time = round(end_time - start_time, 3)

            return jsonify({
                "message": "Image processed and predictions complete",
                "grad_cam_output": f"/static/grad_cam_output.jpg",
                "predicted_class": final_class,
                "predicted_class_custom_model": custom_class,
                "predicted_class_tf_model": tf_class,
                "predicted_class_third_model": nawress,
                "predicted_class_fourth_model": nawress_1,
                "predicted_class_last_model": nawress_5,
                "input_shape": input_shape_list,
                "response_time_seconds": response_time  # ⏱ Response time here
            }), 200

        except Exception as e:
            print(f"Error occurred while processing the file: {e}")
            return jsonify({"error": f"Processing failed: {str(e)}"}), 500

    return jsonify({"error": "Invalid file format. Only jpg, jpeg, png, gif are allowed."}), 400

@app.route('/static/<filename>')
def send_file(filename):
    return send_from_directory(os.path.join(app.root_path, 'static'), filename)
DATA_DIR = "Data"

from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Now you can access them
openai_key = os.getenv("OPENAI_API_KEY")
groq_key = os.getenv("GROQ_API_KEY")
langchain_key = os.getenv("LANGCHAIN_API_KEY")
langchain_tracing = os.getenv("LANGCHAIN_TRACING_V2")

# Load your docstore and vectorstore, and initialize retriever
try:
    print("Loading docstore...")
    with open(os.path.join(DATA_DIR, "docstore (1).pkl"), "rb") as f:
        store = pickle.load(f)

    print("Loading Chroma vectorstore...")
    vectorstore = Chroma(
        collection_name="multi_modal_rag",
        embedding_function=OpenAIEmbeddings(),
        persist_directory=os.path.join(DATA_DIR, "chroma_db")
    )

    print("Loading PersistentClient (optional)...")
    chroma_db_path = os.path.join(DATA_DIR, "chroma_db")
    vectordb = PersistentClient(path=chroma_db_path)

    print("Initializing retriever...")
    retriever = MultiVectorRetriever(
        vectorstore=vectorstore,
        docstore=store,
        id_key="doc_id"
    )

    print("✅ All components loaded successfully.")

except Exception as e:
    print("❌ Error during initialization:", e)
    traceback.print_exc()

client = OpenAI()
def get_images_base64(original):
    images_b64 = []
    if "CompositeElement" in str(type(original)):
        orig_elements = getattr(original.metadata, "orig_elements", [])
        for el in orig_elements:
            if "Image" in str(type(el)):
                image_b64 = getattr(el.metadata, "image_base64", None)
                if image_b64:
                    images_b64.append(image_b64)
    return images_b64



def generate_gpt_answer(question, docs_text, lang='fr'):
    # --- Prompt setup ---
    if lang == 'en':
        prompt = f"""
You are a professional and competent medical assistant.

Your task is to carefully read the provided medical excerpts and generate a clear, well-structured, and easy-to-read response in clean HTML format.

⚠️ Use only the provided excerpts to answer. Do not add any information that is not present in these excerpts. Avoid assumptions or external additions.

You may rephrase the excerpts to improve clarity and coherence, without introducing new information.

Instructions:
- Include a short introductory paragraph explaining the context of the question (1–2 sentences).
- Organize the response into clear sections using HTML <h3> headings, and use <ul><li> lists to group symptoms by category (e.g., cardiac, respiratory, systemic).
- For each symptom, add a brief medical explanation in parentheses if necessary.
- Conclude with 1–2 sentences summarizing the overall medical implication or next steps.
- ⚠️ DO NOT include code blocks or Markdown formatting. Use only raw HTML.
- Ensure every symptom is inside a <li> under its <h3> category. Do not leave any text outside sections.

Question:
{question}

Excerpts:
{docs_text}

Your answer:
"""
    else:
        prompt = f"""
Vous êtes un assistant médical professionnel et compétent.

Votre tâche est de lire attentivement les extraits médicaux fournis et de générer une réponse claire, bien structurée et facile à lire au format HTML propre.

⚠️ Utilisez uniquement les extraits fournis pour répondre. Évitez d’ajouter des informations qui ne figurent pas dans ces extraits. Ne faites pas de suppositions ni d’apports extérieurs.

Vous pouvez reformuler les extraits afin d’améliorer la clarté et la cohérence, sans introduire d’informations nouvelles.

Consignes :
- Inclure un court paragraphe introductif expliquant le contexte de la question (1-2 phrases).
- Organisez la réponse en sections claires avec des titres HTML <h3>, et utilisez des listes <ul><li> pour regrouper les symptômes par catégories (par exemple : cardiaque, respiratoire, systémique).
- Pour chaque symptôme, ajouter une courte explication médicale entre parenthèses si nécessaire.
- Conclure par 1-2 phrases résumant l'implication médicale globale ou les étapes suivantes.
- ⚠️ NE PAS inclure de blocs de code ou formatage Markdown. Juste le HTML brut.
- Assurez-vous que chaque symptôme est à l'intérieur d'un <li> sous sa catégorie <h3>. Ne laissez aucun texte hors des sections.

Question :
{question}

Extraits :
{docs_text}

Votre réponse :
"""

    # --- Call GPT ---
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=800,
        temperature=0,
    )

    raw_html = response.choices[0].message.content.strip()

    # --- Sanitize & organize HTML ---
    soup = BeautifulSoup(raw_html, 'html.parser')

    # Remove <p> wrappers but keep their content
    for p_tag in soup.find_all('p'):
        p_tag.unwrap()

    # Remove consecutive <br> tags
    for br_tag in soup.find_all('br'):
        next_sibling = br_tag.next_sibling
        if next_sibling and next_sibling.name == 'br':
            br_tag.extract()

    # Wrap any orphan text (not inside h3 or li) into <p>
    for elem in soup.contents:
        if isinstance(elem, str) and elem.strip():
            new_tag = soup.new_tag('p')
            new_tag.string = elem.strip()
            elem.replace_with(new_tag)

    # Ensure all <h3> are followed by <ul> if not already
    for h3 in soup.find_all('h3'):
        next_sib = h3.find_next_sibling()
        if not next_sib or next_sib.name != 'ul':
            new_ul = soup.new_tag('ul')
            h3.insert_after(new_ul)

    # Ensure all top-level <li> are inside <ul>
    for li in soup.find_all('li'):
        if li.parent.name != 'ul':
            new_ul = soup.new_tag('ul')
            li.wrap(new_ul)

    clean_html = str(soup)
    return clean_html


def extract_text_from_composite(element):
    if hasattr(element, 'elements') and isinstance(element.elements, list):
        return ' '.join(extract_text_from_composite(child) for child in element.elements)
    elif hasattr(element, 'text') and isinstance(element.text, str):
        return element.text.strip()
    elif hasattr(element, 'content') and isinstance(element.content, str):
        return element.content.strip()
    else:
        return ''

import time

chat_memory = {}

@app.route('/api/chat', methods=['POST'])
def chat():
    start_time = time.time()  # <-- Start timing here
    try:
        data = request.json
        print(f"📥 Received data: {data}")

        question = data.get('question', '').strip()
        user_id = data.get('user_id', 'default_user')
        print(f"📝 Question extracted: '{question}'")

        if not question:
            print("⚠️ No question provided.")
            elapsed = time.time() - start_time
            return jsonify({'error': 'Question is required', 'response_time_sec': round(elapsed, 3)}), 400

        # 🧠 Short-term memory logic
        previous_question = chat_memory.get(user_id)
        if previous_question and any(ref in question.lower() for ref in ['it', 'that', 'this', 'ça', 'cela', 'celui-ci']):
            question = f"{previous_question}. {question}"
            print(f"🔁 Adjusted question with memory: {question}")

        chat_memory[user_id] = question

        # 🌍 Language detection
        try:
            lang = detect(question)
            if lang not in ['fr', 'en']:
                lang = 'fr'
        except LangDetectException:
            lang = 'fr'

        # 📚 Retrieve summaries (docs)
        docs = retriever.vectorstore.similarity_search(question)
        original_texts = []

        for doc in docs:
            doc_id = doc.metadata.get("doc_id") if isinstance(doc.metadata, dict) else getattr(doc.metadata, "doc_id", None)
            original = retriever.docstore.mget([doc_id])[0]
            try:
                text = extract_text_from_composite(original)
            except Exception as e:
                print(f"❌ Extraction error for doc_id {doc_id}: {e}")
                text = None
            if text and text.strip():
                original_texts.append(text.strip())

        docs_text = "\n\n".join(doc.page_content for doc in docs)

        # 🧪 Evaluate ContextRelevance before GPT generation
        from ragas.metrics import ContextRelevance
        from datasets import Dataset
        from ragas import evaluate
        from statistics import mean

        context_data = {
            "question": [question],
            "contexts": [[doc.page_content for doc in docs]],
            "response": ["placeholder"]
        }
        context_dataset = Dataset.from_dict(context_data)
        context_metrics = [ContextRelevance()]
        context_results = evaluate(context_dataset, metrics=context_metrics)
        print("DEBUG context_results:", context_results)

        context_score = round(mean(context_results["nv_context_relevance"]), 4)
        print(f"📉 ContextRelevance score: {context_score}")

        if context_score < 0.6:
            polite_msg = (
                "Les documents à disposition ne semblent pas contenir d'informations suffisamment pertinentes sur ce sujet. "
                "Nous vous invitons à consulter d'autres sources spécialisées."
                if lang == 'fr' else
                "The available documents do not appear to contain sufficient relevant information on this topic. "
                "We suggest consulting other specialized sources."
            )
            elapsed = time.time() - start_time
            return jsonify({
                'answer': polite_msg,
                'origin': [doc.page_content for doc in docs] if docs else [],
                'ragas_scores': {
                    'faithfulness': None,
                    'nv_context_relevance': context_score
                },
                'response_time_sec': round(elapsed, 3)
            }), 200

        # 🤖 Generate answer from summaries
        gpt_answer = generate_gpt_answer(question, docs_text, lang=lang)
        print(f"🤖 GPT answer generated (first 100 chars): {gpt_answer[:100]}...")

        # 🧪 Full RAGAS evaluation
        from ragas.metrics import Faithfulness
        ragas_data = {
            "question": [question],
            "contexts": [[doc.page_content for doc in docs]],
            "response": [gpt_answer],
        }
        ragas_dataset = Dataset.from_dict(ragas_data)
        ragas_metrics = [Faithfulness(), ContextRelevance()]
        ragas_results = evaluate(ragas_dataset, metrics=ragas_metrics)
        eval_scores = {
            metric.name: round(mean(ragas_results[metric.name]), 4) for metric in ragas_metrics
        }
        print("📊 Parsed RAGAS scores:", eval_scores)

        # 🖼️ Gather base64 images (COMPACT STRUCTURE)
        images_html = []
        for doc in docs:
            doc_id = doc.metadata.get("doc_id") if isinstance(doc.metadata, dict) else getattr(doc.metadata, "doc_id", None)
            if not doc_id:
                continue
            original = retriever.docstore.mget([doc_id])[0]
            if not original:
                continue

            # CHANGED: push only .image-wrapper with .message-image (no per-image .image-gallery)
            if "CompositeElement" in str(type(original)):
                for img_b64 in get_images_base64(original):
                    images_html.append(
                        f"<div class='image-wrapper'><img class='message-image' src='data:image/jpeg;base64,{img_b64}' alt='Image médicale' /></div>"
                    )

        # Build final HTML parts
        response_parts = [gpt_answer]

        # CHANGED: group ALL images in ONE gallery + bilingual title; avoid stacking blocks
        if images_html:
            images_title = "Images associées" if lang == 'fr' else "Associated images"
            gallery_block = (
                f"<h3 class='images-title'>{images_title}</h3>"
                f"<div class='image-gallery'>{''.join(images_html)}</div>"
            )
            response_parts.append(gallery_block)

        elapsed = time.time() - start_time  # <-- End timing here

        return jsonify({
            # CHANGED: join without extra blank lines to avoid stray text nodes
            'answer': ''.join(response_parts),
            'origin': original_texts if original_texts else [
                "Aucun texte original n'a été trouvé." if lang == 'fr' else "No original text was found."
            ],
            'ragas_scores': eval_scores,
            'response_time_sec': round(elapsed, 3)  # Return elapsed time in seconds
        }), 200

    except Exception as e:
        print("\n🚨 Exception:", e)
        import traceback
        traceback.print_exc()
        elapsed = time.time() - start_time
        return jsonify({'error': str(e), 'response_time_sec': round(elapsed, 3)}), 500


@app.route('/api/clinical-case', methods=['POST'])
def clinical_case():
    start_time = time.time()
    try:
        data = request.json
        print(f"📥 Clinical case received: {data}")

        case_details = data.get("caseDetails", "").strip()
        user_id = data.get("userId", "anonymous")

        if not case_details:
            elapsed = time.time() - start_time
            return jsonify({'error': 'Missing case details', 'response_time_sec': round(elapsed, 3)}), 400

        # 🌍 Language detection
        try:
            lang = detect(case_details)
            if lang not in ['fr', 'en']:
                lang = 'fr'
        except LangDetectException:
            lang = 'fr'

        # 📚 Retrieve documents from vector store
        docs = retriever.vectorstore.similarity_search(case_details)
        print(f"🔍 {len(docs)} documents retrieved for clinical case.")

        if not docs:
            elapsed = time.time() - start_time
            msg = "Aucun document pertinent trouvé." if lang == 'fr' else "No relevant documents found."
            return jsonify({'error': msg, 'response_time_sec': round(elapsed, 3)}), 404

        original_texts = []
        for doc in docs:
            doc_id = doc.metadata.get("doc_id") if isinstance(doc.metadata, dict) else getattr(doc.metadata, "doc_id", None)
            if not doc_id:
                continue

            original = retriever.docstore.mget([doc_id])[0]
            if not original:
                continue

            try:
                text = extract_text_from_composite(original)
            except Exception as e:
                print(f"❌ Error extracting text for doc_id {doc_id}: {e}")
                text = None

            if text and text.strip():
                original_texts.append(text.strip())

        docs_text = "\n\n".join(doc.page_content for doc in docs)

        # 🧪 Pre-GPT ContextRelevance check
        from ragas.metrics import ContextRelevance
        from datasets import Dataset
        from ragas import evaluate
        from statistics import mean

        context_data = {
            "question": [case_details],
            "contexts": [[doc.page_content for doc in docs]],
            "response": ["placeholder"]
        }
        context_dataset = Dataset.from_dict(context_data)
        context_results = evaluate(context_dataset, metrics=[ContextRelevance()])
        context_score = round(mean(context_results["nv_context_relevance"]), 4)
        print(f"📉 ContextRelevance score: {context_score}")

        if context_score < 0.6:
            polite_msg = (
                "Les documents à disposition ne semblent pas contenir d'informations suffisamment pertinentes sur ce cas."
                if lang == 'fr' else
                "The available documents do not appear to contain sufficient relevant information on this case."
            )
            elapsed = time.time() - start_time
            return jsonify({
                'answer': polite_msg,
                'origin': [doc.page_content for doc in docs] if docs else [],
                'ragas_scores': {
                    'faithfulness': None,
                    'nv_context_relevance': context_score
                },
                'response_time_sec': round(elapsed, 3)
            }), 200

        # 🤖 Generate GPT answer
        client = OpenAI()
        prompt = build_clinical_prompt(case_details, docs_text, lang)  # <-- helper fn to keep it clean
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            temperature=0
        )

        gpt_answer = response.choices[0].message.content.strip()
        print(f"🤖 GPT answer generated (first 100 chars): {gpt_answer[:100]}...")

        # 🧪 Full RAGAS evaluation (Faithfulness + ContextRelevance)
        from ragas.metrics import Faithfulness
        ragas_data = {
            "question": [case_details],
            "contexts": [[doc.page_content for doc in docs]],
            "response": [gpt_answer],
        }
        ragas_dataset = Dataset.from_dict(ragas_data)
        ragas_metrics = [Faithfulness(), ContextRelevance()]
        ragas_results = evaluate(ragas_dataset, metrics=ragas_metrics)

        eval_scores = {
            metric.name: round(mean(ragas_results[metric.name]), 4) for metric in ragas_metrics
        }
        print("📊 Parsed RAGAS scores:", eval_scores)

        # 🖼️ Gather base64 images
        images_html = []
        for doc in docs:
            doc_id = doc.metadata.get("doc_id") if isinstance(doc.metadata, dict) else getattr(doc.metadata, "doc_id", None)
            if not doc_id:
                continue
            original = retriever.docstore.mget([doc_id])[0]
            if not original:
                continue
            if "CompositeElement" in str(type(original)):
                for img_b64 in get_images_base64(original):
                    images_html.append(
                        f"""
                        <div class="image-gallery">
                          <div class="image-wrapper">
                            <img src='data:image/jpeg;base64,{img_b64}' alt='Medical image' />
                          </div>
                        </div>
                        """
                    )

        response_parts = [gpt_answer]
        if images_html:
            response_parts.append("<h3>Associated Images</h3>" if lang == 'en' else "<h3>Images associées</h3>")
            response_parts.extend(images_html)

        elapsed = time.time() - start_time
        return jsonify({
            'answer': "\n\n".join(response_parts),
            'origin': original_texts if original_texts else [
                "Aucun texte original trouvé." if lang == 'fr' else "No original text found."
            ],
            'ragas_scores': eval_scores,
            'response_time_sec': round(elapsed, 3)
        }), 200

    except Exception as e:
        print("❌ Error in /api/clinical-case:", e)
        import traceback
        traceback.print_exc()
        elapsed = time.time() - start_time
        return jsonify({'error': str(e), 'response_time_sec': round(elapsed, 3)}), 500


def build_clinical_prompt(case_details, docs_text, lang):
    if lang == 'en':
        return f"""
You are a clinical reasoning assistant helping medical professionals.

A clinical case is presented below. Your task is to analyze it and provide a structured medical response in clear HTML format.

You have the following relevant medical documents to help you:

{docs_text}

IMPORTANT: Base your entire response strictly on the information contained in the above documents. 
Do NOT include any information or assumptions that are not supported by the documents.

Include these sections:

1. <h3>Summary of the Case</h3>
2. <h3>Most Likely Diagnosis</h3>
3. <h3>Alternative Diagnoses (Differential Diagnosis)</h3>
4. <h3>Initial Investigations and First Steps</h3>
5. <h3>Treatment Proposal</h3>

Here is the clinical case:

{case_details}
"""
    else:
        return f"""
Vous êtes un assistant en raisonnement clinique destiné aux professionnels de santé.

Un cas clinique vous est présenté. Votre tâche est de l’analyser et de fournir une réponse médicale structurée au format HTML clair.

Vous disposez des documents médicaux pertinents suivants pour vous aider :

{docs_text}

IMPORTANT : Basez toute votre réponse strictement sur les informations contenues dans les documents ci-dessus. 
N’incluez aucune information ou hypothèse non étayée par ces documents.

Incluez les sections suivantes :

1. <h3>Résumé du cas</h3>
2. <h3>Diagnostic le plus probable</h3>
3. <h3>Diagnostics différentiels</h3>
4. <h3>Examens initiaux et premières étapes</h3>
5. <h3>Proposition de traitement</h3>

Voici le cas clinique :

{case_details}
"""

if __name__ == '__main__':
    app.run(port=3000, debug=True)

