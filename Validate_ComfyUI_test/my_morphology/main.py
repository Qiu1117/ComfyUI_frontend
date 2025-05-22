import sys, os
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
sys.path.append(project_root)

from pmt_type import *
from pmt_type_options import *
from typing import Annotated, Tuple


# Your import goes here
from skimage import morphology
from skimage.morphology import ball, disk, cube, square


class my_morphology:
    ### The following variables are mandatory
    DESCRIPTION = 'Do morphology operation on given 2D data '
    VERSION = '1.0'
    AUTHOR = 'PMT'
    EXECUTABLE_FUNCTION = ["morphology"]   # list the function name you want to execute in the Node
    
    operation_types = Annotated[str, COMBO(enum_types=['erosion', 
                                                    'dilation', 
                                                    'opening', 
                                                    'closing',
                                                    'white_tophat',
                                                    'black_tophat',
                                                    'skeletonize',
                                                    'thin',
                                                    'convex_hull'])]
    selem_types = Annotated[str, COMBO(enum_types=['disk', 'square'])]  # 2D only
    # Your function correspond to EXECUTABLE_FUNCTION
    # The docstring must be in the requested format as below (like Google style)
    # The input / output variable name must be mentioned in the docstring
    # The input / output variable must be type hinting correctly with predefined types
    # For detail of hint types, please refer to documents or pmt_type.py  
    
    @staticmethod
    @validate_annotations   # use to valid Array, Matrix, Volume's dims
    def morphology(data: Matrix, operation: operation_types ='erosion',  
                     selem_type: selem_types ='disk', selem_size: int =3) -> Matrix:
        """
        Do morphology operation on given 2D data 
        
        Source:
            data: the name must be same as your first input's variable name
            
        Args:
            operation: argument is the parameter of the Node
            selem_type: type of the structure element, default is 'disk'
            selem_size: size of the structure element, default is 3

        Outputs:
            morphologied_data: output data processed by morphology operation
                """
        
        if selem_type.lower() == 'disk':
            selem = disk(selem_size)
        elif selem_type.lower() == 'square':
            selem = square(selem_size)
        else:
            raise ValueError("Must be 'disk' or 'square' for 2D input")
            # else:  # dimensions == 3
            #     if selem_type.lower() == 'ball':
            #         selem = ball(selem_size)
            #     elif selem_type.lower() == 'cube':
            #         selem = cube(selem_size)
            #     else:
            #         raise ValueError("3D操作中，selem_type必须是'ball'或'cube'")
        
        # Morphology operations
        if operation.lower() == 'erosion':
            return morphology.erosion(data, selem)
        
        elif operation.lower() == 'dilation':
            return morphology.dilation(data, selem)
        
        elif operation.lower() == 'opening':
            return morphology.opening(data, selem)
        
        elif operation.lower() == 'closing':
            return morphology.closing(data, selem)
        
        elif operation.lower() == 'white_tophat':
            return morphology.white_tophat(data, selem)
        
        elif operation.lower() == 'black_tophat':
            return morphology.black_tophat(data, selem)
        
        elif operation.lower() == 'skeletonize':
            # no need structure element for skeletonize
            
            return morphology.skeletonize(data)

        
        elif operation.lower() == 'thin':
            return morphology.thin(data)
        
        elif operation.lower() == 'convex_hull':
            return morphology.convex_hull_image(data)
        
        # elif operation.lower() == 'remove_small_objects':
        #     # use default parameters
        #     min_size = kwargs.get('min_size', 64)
        #     connectivity = kwargs.get('connectivity', 1)
        #     return morphology.remove_small_objects(data, min_size=min_size, 
        #                                         connectivity=connectivity)
        
        # elif operation.lower() == 'remove_small_holes':
        #     # user default parameters
        #     area_threshold = kwargs.get('area_threshold', 64)
        #     connectivity = kwargs.get('connectivity', 1)
        #     return morphology.remove_small_holes(data, area_threshold=area_threshold,
        #                                         connectivity=connectivity)
        
        else:
            raise ValueError("Not available: {}".format(operation))
    
    


if __name__ == "__main__":
    ### You can test your code here
    # import numpy as np
    # from skimage import data, color
    # from matplotlib import pyplot as plt

    # image_2d = color.rgb2gray(data.astronaut())
    # image_2d = (image_2d > 0.5).astype(np.bool_)  # 二值化

    # eroded_2d = my_morphology().morphology(image_2d, operation='erosion', selem_size=5)

    # plt.imshow(eroded_2d, cmap='gray')
    # plt.show()
    pass
