import React, { useState } from 'react';
import { Form, Input, Button, Card, Row, Col, Divider, message, Select, DatePicker } from 'antd';
import { useNavigate } from 'react-router-dom';
import apiClient from '../config/api';
import logo from '../assets/logo_1.png';
import './AddHRMSData.css';
import moment from 'moment';
import { formatDateToDDMMYYYY } from '../utils/dateUtils';

const { Option } = Select;
const { TextArea } = Input;

const AddHRMSData: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const formattedValues = { ...values };
      
      // Format date fields
      Object.keys(formattedValues).forEach(key => {
        if (formattedValues[key] && typeof formattedValues[key] === 'object' && formattedValues[key].$d) {
          formattedValues[key] = formatDateToDDMMYYYY(formattedValues[key].$d.toISOString());
        }
        if (formattedValues[key] === '' || formattedValues[key] === undefined) {
          formattedValues[key] = null;
        }
        if (typeof formattedValues[key] === 'string' && formattedValues[key]?.includes(',')) {
          formattedValues[key] = formattedValues[key].replace(/,/g, '');
        }
      });

      const response = await apiClient.post('/hrms_data', formattedValues);
      
      message.success('HRMS record added successfully');
      form.resetFields();
      navigate('/AddHRMSData');
    } catch (error: any) {
      console.error('Error adding HRMS data:', error);
      
      if (error.response?.status === 400) {
        message.error(`Validation error: ${error.response.data.error}`);
      } else if (error.response?.data?.error) {
        message.error(`Server error: ${error.response.data.error}`);
      } else if (error.code === 'NETWORK_ERROR') {
        message.error('Network error - could not connect to server');
      } else {
        message.error(error.message || 'An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="homepage">
      <div className="routing-header-bar" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '1rem 2rem 0 2rem' }}>
        <div className="homepage-logo-top-left">
          <img src={logo} alt="Alchemy Logo" />
        </div>
        <h2 style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          color: 'white', 
          fontWeight: 700, 
          fontSize: '2rem', 
          fontFamily: 'Montserrat, sans-serif', 
          margin: 0, 
          zIndex: 1 
        }}>Add New HRMS Data</h2>
        <div className="auth-buttons-container">
          <button className="auth-button" onClick={() => navigate(-1)}>Back</button>
          <button className="auth-button" onClick={() => navigate('/HomePage')}>Home</button>
          <button className="auth-button" onClick={() => document.getElementById('excel-file-input')?.click()}>Import Excel File</button>
          <button className="auth-button" onClick={() => navigate('/')}>Log-Out</button>
        </div>
      </div>
      <div className="add-hrms-container" style={{ marginTop: '2rem' }}>
        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // Handle Excel file import here
              message.info('Excel import functionality will be implemented');
            }
          }}
        />
    <Card bordered={false} className="hrms-form-card">
  <Form
    form={form}
    layout="vertical"
    onFinish={onFinish}
    autoComplete="off"
    scrollToFirstError
  >
    {/* Basic Information Section */}
    <Divider orientation="left">Basic Information</Divider>
    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="sl_no" name="sl_no" rules={[{ required: true }]}>
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="category" name="category">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="category_daily_report" name="category_daily_report">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="account_manager" name="account_manager">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="sbu_head" name="sbu_head">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="client_lob_daily_report" name="client_lob_daily_report">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="FUNCTION" name="FUNCTION">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="deployment_category" name="deployment_category">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="emp_status" name="emp_status">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="work_location" name="work_location">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="salary_mode" name="salary_mode">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="BAND" name="BAND">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    {/* Personal Information Section */}
    <Divider orientation="left">Personal Information</Divider>
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item label="candidate_name" name="candidate_name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="GENDER" name="GENDER" rules={[{ required: true }]}>
          <Select>
            <Option value="MALE">Male</Option>
            <Option value="FEMALE">Female</Option>
            <Option value="OTHER">Other</Option>
          </Select>
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="father_name" name="father_name">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="DOB" name="DOB">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="blood_group" name="blood_group">
          <Select>
            <Option value="A+">A+</Option>
            <Option value="A-">A-</Option>
            <Option value="B+">B+</Option>
            <Option value="B-">B-</Option>
            <Option value="AB+">AB+</Option>
            <Option value="AB-">AB-</Option>
            <Option value="O+">O+</Option>
            <Option value="O-">O-</Option>
          </Select>
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="contact_no" name="contact_no" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="emergency_contact_no" name="emergency_contact_no">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="RELATIONSHIP" name="RELATIONSHIP">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="SOURCE" name="SOURCE">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="PERSONALID" name="PERSONALID">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="updated_personal_id" name="updated_personal_id">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    {/* Address Information */}
    <Divider orientation="left">Address Information</Divider>
    <Row gutter={16}>
      <Col span={12}>
        <Form.Item label="current_address" name="current_address">
          <TextArea rows={3} />
        </Form.Item>
      </Col>
      <Col span={12}>
        <Form.Item label="permanent_address" name="permanent_address">
          <TextArea rows={3} />
        </Form.Item>
      </Col>
    </Row>

    {/* Employment Information */}
    <Divider orientation="left">Employment Information</Divider>
    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="alchemy_id" name="alchemy_id">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="resource_client_id" name="resource_client_id">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="CLIENT" name="CLIENT">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="LOB" name="LOB">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="client_lob" name="client_lob">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="deployment_status" name="deployment_status">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="DESIGNATION" name="DESIGNATION">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="EXPERIENCE" name="EXPERIENCE">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="SKILL" name="SKILL">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="skill_category" name="skill_category">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="skill_function" name="skill_function">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="DOMAIN" name="DOMAIN">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="TECHNOLOGY" name="TECHNOLOGY">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="CLIENTID" name="CLIENTID">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="project_name" name="project_name">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="building_name" name="building_name">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="project_manager" name="project_manager">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="pm_contact_number" name="pm_contact_number">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="pm_email_id" name="pm_email_id">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    {/* Salary Information */}
    <Divider orientation="left">Salary Information</Divider>
    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="BASIC" name="BASIC">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="HRA" name="HRA">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="conveyance_allowance" name="conveyance_allowance">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="special_allowance" name="special_allowance">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="MEDICAL" name="MEDICAL">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="statutory_bonus" name="statutory_bonus">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="gross_salary_part_a" name="gross_salary_part_a">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="pf_employer" name="pf_employer">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="esi_employer" name="esi_employer">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="employer_lwf" name="employer_lwf">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="earned_leave" name="earned_leave">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="GRATUITY" name="GRATUITY">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="employer_contributions_part_b" name="employer_contributions_part_b">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="pf_employee" name="pf_employee">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="esi_employee" name="esi_employee">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="employee_lwf" name="employee_lwf">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="professional_tax_or_tds" name="professional_tax_or_tds">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="health_insurance" name="health_insurance">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="LTA" name="LTA">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="continuity_bonus" name="continuity_bonus">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="PVP" name="PVP">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="total_employee_deductions_c_" name="total_employee_deductions_c_">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="total_ctc_offer_letter" name="total_ctc_offer_letter">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="fixed_ctc" name="fixed_ctc">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="net_payable_take_home" name="net_payable_take_home">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="leave_cost_for_margin_calculation" name="leave_cost_for_margin_calculation">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="vendor_margin" name="vendor_margin">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="gross_margin" name="gross_margin">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="gross_margin_percentage" name="gross_margin_percentage">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    {/* PO Information */}
    <Divider orientation="left">PO Information</Divider>
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item label="po_number_sow_wo" name="po_number_sow_wo">
          <Input />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="po_start_date" name="po_start_date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="po_end_date" name="po_end_date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="po_status" name="po_status">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="portal_value" name="portal_value">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="difference_in_po_rate" name="difference_in_po_rate">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="po_value" name="po_value">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    {/* Joining Information */}
    <Divider orientation="left">Joining Information</Divider>
    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="DOJ" name="DOJ">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="MONTH" name="MONTH">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="YEAR" name="YEAR">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="doj_client_place" name="doj_client_place">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="doj_rd" name="doj_rd">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="confirmation_date_in_alchemy" name="confirmation_date_in_alchemy">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="increment_date" name="increment_date">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="INCREMENT AMOUNT" name="INCREMENT AMOUNT">
          <Input type="number" />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="city_as_per_onboarding" name="city_as_per_onboarding">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="city_as_per_minimum_wages" name="city_as_per_minimum_wages">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="state_as_per_minimum_wages" name="state_as_per_minimum_wages">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="probation_period" name="probation_period">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="leave_encashment_eligibility" name="leave_encashment_eligibility">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="no_of_leaves" name="no_of_leaves">
          <Input type="number" />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="NOTICE PERIOD" name="NOTICE PERIOD">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="lwd_as_on_client" name="lwd_as_on_client">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={6}>
        <Form.Item label="MONTH_STATUS" name="MONTH_STATUS">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="final_status" name="final_status">
          <Input />
        </Form.Item>
      </Col>
      <Col span={6}>
        <Form.Item label="old_leave_policy_applicable_upto" name="old_leave_policy_applicable_upto">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
    </Row>

    {/* Additional Information */}
    <Divider orientation="left">Additional Information</Divider>
    <Row gutter={16}>
      <Col span={8}>
        <Form.Item label="pan_card_number" name="pan_card_number">
          <Input />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="aadhar_number" name="aadhar_number">
          <Input />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="bank_account_number" name="bank_account_number">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Row gutter={16}>
      <Col span={8}>
        <Form.Item label="ifsc_code" name="ifsc_code">
          <Input />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="REMARKS" name="REMARKS">
          <Input />
        </Form.Item>
      </Col>
      <Col span={8}>
        <Form.Item label="extra" name="extra">
          <Input />
        </Form.Item>
      </Col>
    </Row>

    <Form.Item>
      <Button type="primary" htmlType="submit" loading={loading} size="large">
        Submit
      </Button>
      <Button style={{ marginLeft: 16 }} >
        Cancel
      </Button>
    </Form.Item>
  </Form>
</Card>
      </div>
    </div>
  );
};

export default AddHRMSData;