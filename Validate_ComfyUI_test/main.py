from pmt_type import *
from pmt_type_options import *
from typing import Annotated

from skimage.filters import gaussian
import time


class smooth:
    DESCRIPTION = "This module is used to smooth the data"
    VERSION = "1.0.0"
    AUTHOR = "PMT"
    EXECUTABLE_FUNCTION = ["smooth_2d", "smooth_3d"]
    
    sigma_with_options = Annotated[float, FloatOptions(min=0, max=50, step=0.1)]
    

    def smooth_2d(data: Matrix, sigma: sigma_with_options=0.3) -> tuple[Matrix, str]:
        """
        Smooth 2D data
        
        Source:
            data: input 2D data
            
        Args:
            sigma: hyperparameter of gaussian smooth

        Outputs:
            data: smooth data
            test_txt: test text output
        """
        start = time.time()
        print(f"Smooth start with Sigma={sigma}")
        data = gaussian(data, sigma, preserve_range=True)
        print(f"It takes {time.time() - start} sec")

        test_txt = "this is a text output"
        return data, test_txt
    

    def smooth_3d(data: Volume, sigma: sigma_with_options=0.3) -> tuple[Matrix, str]:
        """
        Smooth 3D data
        
        Source:
            data: input 3D data
            
        Args:
            sigma: hyperparameter of gaussian smooth

        Outputs:
            data: smooth data
            test_txt: test text output
        """

        start = time.time()
        print(f"Smooth start with Sigma={sigma}")
        data = gaussian(data, sigma, preserve_range=True)
        print(f"It takes {time.time() - start} sec")

        test_txt = "this is a text output"
        return data, test_txt



