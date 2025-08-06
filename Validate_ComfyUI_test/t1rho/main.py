import sys, os
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
sys.path.append(project_root)

from pmt_type import *
from pmt_type_options import *
from typing import Annotated, Tuple


# Your import goes here


class t1rho:
    ### The following variables are mandatory
    DESCRIPTION = 'template'
    VERSION = '1.0'
    AUTHOR = 'pmt'
    EXECUTABLE_FUNCTION = ["ab_fitting"]   # list the function name you want to execute in the Node
    
    # Your function correspond to EXECUTABLE_FUNCTION
    # The docstring must be in the requested format as below (like Google style)
    # The input / output variable name must be mentioned in the docstring
    # The input / output variable must be type hinting correctly with predefined types
    # For detail of hint types, please refer to documents or pmt_type.py  

    @staticmethod
    @validate_annotations   # use to valid Array, Matrix, Volume's dims
    def ab_fitting(dyn_scan1: Matrix, dyn_scan2: Matrix, dyn_scan3: Matrix|None, dyn_scan4: Matrix|None, 
                   fsl1:float=0, fsl2:float=0.01, fsl3:float=0.03, fsl4:float=0.05) -> Matrix:
        

        x = [fsl1, fsl2]
        y = [dyn_scan1, dyn_scan2]

        if dyn_scan3 is not None:
            x.append(fsl3)
            y.append(dyn_scan3)

        if dyn_scan4 is not None:
            x.append(fsl4)
            y.append(dyn_scan4)

        x = np.array(x)  
        x = np.expand_dims(x, axis=(1,2)) 
        y = np.array(y)

        return fit(x, y)


def compute_J(b,x,y):
    '''
    Parameters
    ----------
    b : np array
        H X W
    x : np array, time of spin-lock
        NTSL X h x w
    y : np array, multiple dynamic scans
        NTSL X h x w

    Returns
    -------
    J : np array, cost function value corresponds to every pixels 
        h  x w 

    '''
    # Implementation accroding to Thierry's manuual 
    f1 = np.mean(y*np.exp(-b*x),axis=0)
    alpha1 = np.mean(np.exp(-b*x),axis=0)
    alpha2 = np.mean(np.exp(-2*b*x),axis=0)
    f0 = np.mean(y,axis=0)
        
    a = (f1-alpha1*f0)/(alpha2-alpha1**2)
    L = np.abs(y-a*np.exp(-b*x))
    J = np.sum(L**2,axis=0)
    
    return J


def fit(x, y):
    '''
    Parameters
    ----------
    x : np array, time of spin-lock
        NTSL X h x w
    y : np array, multiple dynamic scans
        NTSL X h x w

    Returns T1rho
    -------
    
    '''
    bmin = 1e-5*np.ones_like(y[0])   
    bmax = 1e5*np.ones_like(y[0])   
    eps = 1e-9
    count =0
    while(1):
        # Dichotomic algorithm. 
        b = (bmin+bmax)/2
        dJ = compute_J(b+eps, x, y) - compute_J(b, x, y)
        pos_idx = np.where(dJ>=0)
        neg_idx = np.where(dJ<0)
        bmax[pos_idx]=b[pos_idx]
        bmin[neg_idx]=b[neg_idx]
        
        interval_length = np.abs(bmax-bmin)
        count+=1
        if np.linalg.norm(interval_length)<1e-3:
            break
        elif count>1000:
            print('take too long, break!')
            break
    return 1/(b+1e-9)   # we are computing R1rho, we need to invert R1rho to t1rho

if __name__ == "__main__":
    ### You can test your code here
    image_list = [r'G:\code\QMR\samples\t1rho_test\dicom\I0010.dcm',
                  r'G:\code\QMR\samples\t1rho_test\dicom\I0020.dcm',
                  r'G:\code\QMR\samples\t1rho_test\dicom\I0030.dcm',
                  None]
    
    imgs = [pydicom.dcmread(x).pixel_array if x else None for x in image_list ]
    fsl = [0, 0.01, 0.03]
    t1r = t1rho.ab_fitting(*imgs, *fsl)
    import matplotlib.pyplot as plt

    plt.figure(1)
    plt.imshow(t1r, vmin=0.02, vmax=0.06,cmap='jet')
    plt.colorbar()
    plt.show()    
    pass
