## Author: Jiabo Xu
## Organization: PMT
## Date: 2025-03-01
## Version: 0.1
## Description: Custom type for pipeline execution in litegraph with type validation
'''
Type used in pipeline / Litegraph
    str -> STRING                  
    int -> INT           
    float -> FLOAT
    bool -> BOOLEAN                
    dict -> DICT    
    Array -> np.array -> 1D                      # 1-D np.ndarray
    Matrix -> np.array -> 2D                     # 2-D np.ndarray
    Volume -> np.array -> 3D                     # 3-D np.ndarray
    DataFrame -> pandas.DataFrame -> TABLE       
    pydicom_dataset -> pydicom.dataset.FileDataset -> DICOM_OBJ     
    DICOM_FILE -> DICOM_FILE
    nifti1 -> nibabel.nifti1.Nifti1Image -> NIFTI_OBJ        
    NIFTI_FILE -> NIFTI_FILE
    IMAGE_FILE -> IMAGE_FILE              # support png, jpg, tiff
    DICOM_VOLUME_FILE -> DICOM_VOLUME_FILE
    SERIES -> SERIES_FILE_LIST
    DICOM_LIST -> DICOM_FILE_LIST
    JSON_FILE -> JSON_FILE
    FILE -> FILE
'''

import numpy as np
import pydicom
import nibabel as nib
import os
import utils
from pandas import DataFrame
from pydicom.dataset import FileDataset as pydicom_dataset


class CUSTOM:
    def __new__(cls, input_str):
        # Input can be any type
        return input_str


class DataFrame(DataFrame):
    def __new__(cls, input_data):
        # Convert input to a DataFrame
        obj = super().__new__(cls, input_data)
        
        # Check if the input is a valid DataFrame
        if not isinstance(obj, DataFrame):
            raise ValueError("Input must be a valid DataFrame.")
        
        return obj
    

class SERIES(list):
    def __new__(cls, input_list):
        # Convert input to a list
        obj = list(input_list)
        
        # Check if the list contains only DICOM_FILE objects
        if not all(utils.is_dicom(item) for item in obj):
            raise ValueError("Input must be a list of path of DICOM files.")
        
        return obj
    

class DICOM_LIST(list):
    def __new__(cls, input_list):
        # Convert input to a list
        obj = list(input_list)
        
        # Check if the list contains only DICOM_FILE objects
        if not all(utils.is_dicom(item) for item in obj):
            raise ValueError("Input must be a list of path of DICOM files.")
        
        return obj


class FILE(str):
    def __new__(cls, input_str):
        # Convert input to a string
        obj = str(input_str)
        
        # Check if the string is a valid file path
        if not os.path.isfile(obj):
            raise ValueError("Input must be a valid file path.")
        
        return obj
    
    
class JSON_FILE(str):
    def __new__(cls, input_str):
        # Convert input to a string
        obj = str(input_str)
        
        # Check if the string is a valid JSON file path
        if not obj.endswith('.json'):
            raise ValueError("Input must be a valid JSON file path.")
        
        # Check if the file exists and is readable
        if not os.path.isfile(obj):
            raise ValueError("Input must be a valid JSON file path.")
        
        return obj
    

class DICOM_FILE(str):
    def __new__(cls, input_str):
        # Convert input to a string
        obj = str(input_str)
        
        # # Check if the string is a valid file path
        # if not obj.endswith('.dcm'):
        #     raise ValueError("Input must be a valid DICOM file path.")
        
        # quick check if the file is a valid DICOM file by only reading the header
        if not utils.is_dicom(obj):
            raise ValueError("Input must be a valid DICOM file path.")
        
        return obj


class NIFTI_FILE(str):
    def __new__(cls, input_str):
        # Convert input to a string
        obj = str(input_str)
        
        # Check if the string is a valid file path
        if not obj.endswith('.nii') and not obj.endswith('.nii.gz'):
            raise ValueError("Input must be a valid NIFTI file path.")
        if not utils.is_valid_nifti(obj):
            raise ValueError("Input must be a valid NIFTI file path.")
        return obj


class IMAGE_FILE(str):
    def __new__(cls, input_str):
        # Convert input to a string
        obj = str(input_str)
        
        # Check if the string is a valid file path
        if not obj.endswith('.png') and not obj.endswith('.jpg') and not obj.endswith('.jpeg') and not obj.endswith('.tiff'):
            raise ValueError("Input must be a valid image file path.")
        
        return obj

class Array(np.ndarray):
    def __new__(cls, input_array):
        # Convert input to an ndarray
        obj = np.asarray(input_array).view(cls)
        
        # Check if the array is 1-dimensional
        if obj.ndim != 1:
            raise ValueError("Input array must be 1-dimensional.")
        
        return obj

    def __array_finalize__(self, obj):
        # This method is called when the object is created
        if obj is None: return
        # Ensure the array remains 1-dimensional after slicing, etc.
        if obj.ndim != 1:
            raise ValueError("Resulting array must be 1-dimensional.")
        

class Matrix(np.ndarray):
    def __new__(cls, input_array):
        # Convert input to an ndarray
        obj = np.asarray(input_array).view(cls)
        
        # Check if the array is 2-dimensional
        if obj.ndim != 2:
            raise ValueError("Input array must be 2-dimensional.")
        
        return obj

    def __array_finalize__(self, obj):
        # This method is called when the object is created
        if obj is None: return
        # Ensure the array remains 2-dimensional after slicing, etc.
        if obj.ndim != 2:
            raise ValueError("Resulting array must be 2-dimensional.")


class Volume(np.ndarray):
    def __new__(cls, input_array):
        # Convert input to an ndarray
        obj = np.asarray(input_array).view(cls)
        
        # Check if the array is 3-dimensional
        if obj.ndim != 3:
            raise ValueError("Input array must be 3-dimensional.")
        
        return obj

    def __array_finalize__(self, obj):
        # This method is called when the object is created
        if obj is None: return
        # Ensure the array remains 3-dimensional after slicing, etc.
        if obj.ndim != 3:
            raise ValueError("Resulting array must be 3-dimensional.")
        


if __name__ == '__main__':
    path = 'G:\\code\\pmt-software\\Pipeline_Core\\test_data\\brain_seed002\\IMG-0003-00001.dcm'
    nii_path = 'G:\\code\pmt-software\\Pipeline_Core\\test_data\\brain_seed002.nii.gz'
    import time 
    s1 = time.time()
    dicom = pydicom.dcmread(path)
    s2 = time.time() 
    print(s2 - s1)
    c = dicom.pixel_array
    s3 = time.time()
    print(s3 - s2)
#    a = nib.load(nii_path)