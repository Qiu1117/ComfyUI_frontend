## Author: Jiabo Xu
## Organization: PMT
## Date: 2025-03-01
## Version: 0.1
## Description: Additional options for each custom type used for pipeline execution in litegraph
from typing import Annotated, TypeVar, Type, cast, get_type_hints, get_origin, get_args
import functools
import inspect
from pmt_type import *

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
    COMBO
'''

class COMBO:
    def __init__(self, enum_types: list):
        self.enum_types = enum_types
    

class ArrayOptions:
    '''
        describe the length of the array, if it is unknown set it to None by default
        and also describe what it represents
    '''
    def __init__(self, dim=None, dim_desc=None):
        self.dim = dim
        self.dim_desc = dim_desc

    def validate(self, array):
        '''
            Validate the array length against the specified options.
        '''
        if self.dim is not None and len(array) != self.dim:
            raise ValueError(f"Array length must be {self.dim}, got {len(array)}")
        
        return True
    

class MatrixOptions:
    '''
        describe the length of each dimension, if it is unknown set it to None by default
        and also describe what it represents
    '''
    def __init__(self, first_dim=None, second_dim=None, first_dim_desc=None, second_dim_desc=None):
        self.first_dim = first_dim
        self.second_dim = second_dim

        self.first_dim_desc = first_dim_desc
        self.second_dim_desc = second_dim_desc

    def validate(self, matrix):
        '''
            Validate the matrix dimensions against the specified options.
        '''
        shape = matrix.shape
        if self.first_dim is not None and shape[0] != self.first_dim:
            raise ValueError(f"First dimension must be {self.first_dim}, got {shape[0]}")
        
        if self.second_dim is not None and shape[1] != self.second_dim:
            raise ValueError(f"Second dimension must be {self.second_dim}, got {shape[1]}")
        
        return True


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

    def validate(self, volume):
        '''
            Validate the volume dimensions against the specified options.
        '''
        shape = volume.shape
        if self.fisrt_dim is not None and shape[0] != self.fisrt_dim:
            raise ValueError(f"First dimension must be {self.fisrt_dim}, got {shape[0]}")
        
        if self.second_dim is not None and shape[1] != self.second_dim:
            raise ValueError(f"Second dimension must be {self.second_dim}, got {shape[1]}")
        
        if self.third_dim is not None and shape[2] != self.third_dim:
            raise ValueError(f"Third dimension must be {self.third_dim}, got {shape[2]}")
        
        return True
    
    
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


# A decorator to validate if real value obeies the annotations of a function
def validate_annotations(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        sig = inspect.signature(func)
        bound_args = sig.bind(*args, **kwargs)
        bound_args.apply_defaults()
        
        # get type hints of the function
        type_hints = get_type_hints(func, include_extras=True)
        
        # check every parameter
        for param_name, param_value in bound_args.arguments.items():
            if param_name in type_hints:

                hint = type_hints[param_name]
                # check if Annotated 
                if get_origin(hint) is Annotated:
                    args_of_annotated = get_args(hint)
                    if args_of_annotated and args_of_annotated[0] is Matrix:
                        for arg in args_of_annotated[1:]:
                            if isinstance(arg, MatrixOptions):
                                value_to_validate = param_value if isinstance(param_value, Matrix) else Matrix(param_value)
                                arg.validate(value_to_validate)
                            elif isinstance(arg, VolumeOptions):
                                value_to_validate = param_value if isinstance(param_value, Volume) else Volume(param_value)
                                arg.validate(value_to_validate)
                            elif isinstance(arg, ArrayOptions):
                                value_to_validate = param_value if isinstance(param_value, Array) else Array(param_value)
                                arg.validate(value_to_validate)

        
        return func(*args, **kwargs)
    return wrapper