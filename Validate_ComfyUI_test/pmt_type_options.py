## Author: Jiabo Xu
## Organization: PMT
## Date: 2025-03-01
## Version: 0.1
## Description: Additional options for each custom type used for pipeline execution in litegraph
'''
Avaliable types:
    string
    int
    float
    boolean
    dict
    Array
    Matrix
    Volume
    TABLE
    DICOM_OBJ
    DICOM_FILE
    NIFTI_OBJ
    NIFTI_FILE
    IMAGE_FILE
    DICOM_VOLUME_FILE
    SERIES_FILE_LIST
    DICOM_FILE_LIST
'''

class ArrayOptions:
    '''
        describe the length of the array, if it is unknown set it to None by default
        and also describe what it represents
    '''
    def __init__(self, dim=None, dim_desc=None):
        self.dim = dim
        self.dim_desc = dim_desc


class MatrixOptions:
    '''
        describe the length of each dimension, if it is unknown set it to None by default
        and also describe what it represents
    '''
    def __init__(self, fisrt_dim=None, second_dim=None, fisrt_dim_desc=None, second_dim_desc=None):
        self.fisrt_dim = fisrt_dim
        self.second_dim = second_dim

        self.fisrt_dim_desc = fisrt_dim_desc
        self.second_dim_desc = second_dim_desc


class VolumeOptions:
    '''
        describe the length of each dimension, if it is unknown set it to None by default
        and also describe what it represents
    '''
    def __init__(self, fisrt_dim=None, second_dim=None, third_dim=None, fisrt_dim_desc=None, second_dim_desc=None, third_dim_desc=None):
        self.fisrt_dim = fisrt_dim
        self.second_dim = second_dim
        self.third_dim = third_dim

        self.fisrt_dim_desc = fisrt_dim_desc
        self.second_dim_desc = second_dim_desc
        self.third_dim_desc = third_dim_desc

    
class FloatOptions:
    '''
        describe the range and step of the float number on UI
    '''
    def __init__(self, min=None, max=None, step=None):
        self.min = min
        self.max = max
        self.step = step


class IntOptions:
    '''
        describe the range and step of the integer number on UI
    '''
    def __init__(self, min=None, max=None, step=None):
        self.min = min
        self.max = max
        self.step = step


class StringOptions:
    '''
        set if enable wildcard 
        also, describe the usage of the string
        the usage can be:
            - path
            - url
            - email
            - number (only digits)
    '''
    def __init__(self, regx=True, usage=None, enum=[]):
        self.regx = regx
        self.usage = usage
        self.enum = enum  # UI will show a dropdown list if enum is not empty


class BooleanOptions:
    '''
        describe the usage of the boolean
    '''
    def __init__(self, usage=None):
        self.usage = usage



class DictOptions:
    '''
        describe the usage of the dictionary
    '''
    def __init__(self, enable_add=False):
        self.enable_add = enable_add 


